export class TransactionService {
  factory: Factory<TransactionDocument>;

  constructor(
    @InjectModel(Transaction.name)
    private transactionModel: Model<TransactionDocument>,
    @InjectLogger() private logger: Logger,
    @InjectSearchEngineSearch(Transaction.name)
    private searchEngineService: SearchEngineService,
    private paystackService: PaystackService,
    private walletService: WalletService,
    private databaseService: DatabaseService,
    private stripeService: StripeService,
    @InjectModel(ExternalVerificationMedia.name)
    private externalVerificationMediaModel: Model<ExternalVerificationMediaDocument>,
    @InjectModel(BonusReason.name)
    private bonusReasonModel: Model<BonusReasonDocument>,
    private userService: UserService,
    private notificationProducer: PushNotificationProducer,
    private eventEmitter: EventEmitter2
  ) {
    this.factory = new Factory(this.transactionModel);
  }

  getModel() {
    return this.transactionModel;
  }

  async addTransaction(data: AddTransactionDTO, options?: SaveOptions) {
    const reference = await this.getUniqueReference(data.referencePrefix);

    const [document] = await this.transactionModel.create(
      [{ ...data, reference, referencePrefix: undefined }],
      options
    );

    return document;
  }

  async updateTransactionWithFilter(
    filter: FilterQuery<TransactionDocument>,
    body: UpdateTransactionDTO,
    options?: QueryOptions
  ) {
    const document = await this.transactionModel.findOneAndUpdate(
      filter,
      body,
      { ...options, runValidators: true, new: true }
    );

    return document;
  }

  async getUniqueReference(prefix: string) {
    let unique = false;

    let reference = generateReference(prefix);

    while (!unique) {
      const doc = await this.transactionModel
        .findOne({ reference }, { _id: 1, reference: 1 })
        .lean();

      if (doc) {
        this.logger.log(`Non-unique reference generated: ${reference}`, {
          context: 'TransactionService',
          docId: doc._id,
        });

        reference = generateReference(prefix);
      } else {
        unique = true;
      }
    }

    return reference;
  }

  async getTransactions(query: Record<string, string>) {
    if (query.filter_by) {
      let replaced = query.filter_by;

      replaced = replaced.replaceAll('createdAt:', 'createdAt_timestamp:');
      replaced = replaced.replaceAll('updatedAt:', 'updatedAt_timestamp:');
      replaced = replaced.replaceAll('verifiedAt:', 'verifiedAt_timestamp:');
      replaced = replaced.replaceAll('fulfilledAt:', 'fulfilledAt_timestamp:');

      query.filter_by = replaced;
    }

    if (query.sort_by) {
      let replaced = query.sort_by;

      replaced = replaced.replaceAll('createdAt:', 'createdAt_timestamp:');
      replaced = replaced.replaceAll('updatedAt:', 'updatedAt_timestamp:');
      replaced = replaced.replaceAll('verifiedAt:', 'verifiedAt_timestamp:');
      replaced = replaced.replaceAll('fulfilledAt:', 'fulfilledAt_timestamp:');

      query.sort_by = replaced;
    } else {
      query.sort_by = 'createdAt_timestamp:desc';
    }

    const results = await this.searchEngineService.searchDocuments({
      ...query,
      query_by:
        'currency,firstName,lastName,email,narration,channel,type,scope,status,reference',
      exclude_fields:
        'createdAt_timestamp,updatedAt_timestamp,verifiedAt_timestamp,fulfilledAt_timestamp,__v,' +
        query.exclude_fields,
    });

    return results;
  }

  async initTransaction(
    data: InitTransactionDTO
  ): Promise<InitTransactionReturn> {
    // Create transaction
    const transaction = await this.addTransaction({
      amount: data.amount,
      currency: data.currency,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      channel: data.channel,
      narration: data.narration,
      scope: data.scope,
      type: data.type,
      referencePrefix: data.referencePrefix,
      discountPercent: data.discountPercent,
      discountAmount: data.discountAmount,
    });

    if (data.channel === PaymentChannels.PAYSTACK) {
      // Get Paystack checkout url
      const paystackResponse = await this.paystackService.initTransaction({
        amount: transaction.amount * 100,
        currency: transaction.currency,
        email: transaction.email,
        reference: transaction.reference,
        callback_url: data.callback_url,
        metadata: {
          custom_fields: [
            {
              display_name: 'Discount percent',
              variable_name: 'discountPercent',
              value: transaction.discountPercent,
            },
            {
              display_name: 'Discount amount',
              variable_name: 'discountAmount',
              value: transaction.discountAmount,
            },
          ],
        },
      });

      return {
        transactionId: transaction._id.toString(),
        data: paystackResponse.data,
      };
    }
  }

  async fulfilTransaction(transaction: TransactionDocument, adminId?: string) {
    // fail-safe
    if (transaction.status !== TransactionStatus.SUCCESS) {
      this.logger.warn('Cannot fulfil a transaction that is not successful', {
        context: 'TransactionService',
        transactionId: transaction._id.toString(),
      });

      return;
    }

    let newTransaction: TransactionDocument & { _id: ObjectId };

    const mongoSession = await this.databaseService
      .getDbHandle()
      .startSession();

    await mongoSession.withTransaction(async () => {
      let newWallet: WalletDocument;

      switch (true) {
        case transaction.reference.startsWith(ReferencePrefix.WALLET_TOP_UP):
          newWallet = await this.walletService.topUpWallet({
            transactionAmount: transaction.amount,
            userId: transaction.user,
            reference: transaction.reference,
            options: { session: mongoSession },
          });

          break;

        case transaction.reference.startsWith(ReferencePrefix.AWARD_BONUS):
          newWallet = await this.walletService.topUpBonus({
            amount: transaction.amount,
            userId: transaction.user,
            reference: transaction.reference,
            options: { session: mongoSession },
          });

          break;

        case transaction.reference.startsWith(ReferencePrefix.LOAD_OVERDRAFT):
          newWallet = await this.walletService.loadOverdraft({
            amount: transaction.amount,
            userId: transaction.user,
            reference: transaction.reference,
            options: { session: mongoSession },
          });

          break;

        case transaction.reference.startsWith(ReferencePrefix.UNLOAD_OVERDRAFT):
          newWallet = await this.walletService.unloadOverdraft({
            amount: transaction.amount,
            userId: transaction.user,
            reference: transaction.reference,
            options: { session: mongoSession },
          });

          break;

        case transaction.reference.startsWith(ReferencePrefix.TRANSFER):
          newWallet = await this.walletService.externalTransfer({
            amount: transaction.amount,
            userId: transaction.user,
            userType: transaction.userType,
            reference: transaction.reference,
            options: { session: mongoSession },
          });

        default:
          break;
      }

      if (newWallet) {
        newTransaction = await this.updateTransactionWithFilter(
          {
            reference: transaction.reference,
            status: TransactionStatus.SUCCESS,
            fulfilled: false,
          },
          {
            fulfilled: true,
            balanceAfter:
              transaction.userType === Roles.TUTOR
                ? getTutorNetBalance(newWallet)
                : getClientNetBalance(newWallet),
            fulfilledAt: dayjs().toDate(),
            autoFulfilled: !adminId,
            fulfilledBy: adminId,
            walletAfter: newWallet,
          },
          { session: mongoSession }
        );
      }
    });

    await mongoSession.endSession();

    // meaning that it is automatically being fulfilled
    if (
      transaction.reference.startsWith(ReferencePrefix.WALLET_TOP_UP) &&
      !adminId
    ) {
      this.eventEmitter.emit(TransactionEventNames.NOTIFY_ADMIN, {
        name: toSentenceCase(
          transaction.lastName + ' ' + transaction.firstName
        ),
        amount: formatCurrency(transaction.amount, {
          currency: transaction.currency,
        }),
      });
    }

    return newTransaction;
  }

  @OnEvent(TransactionEventNames.VERIFY_TRANSACTION)
  async autoVerifyTransaction(reference: string) {
    this.logger.info('Attempting to verify transaction', {
      context: 'TransactionService',
      reference,
    });

    const transaction = await this.transactionModel.findOne({
      reference,
      status: TransactionStatus.PENDING,
    });

    if (!transaction) {
      this.logger.error('Transaction not found', {
        context: 'TransactionService',
        reference,
      });

      return;
    }

    const verifiedDoc = await this.updateTransactionWithFilter(
      { reference, status: TransactionStatus.PENDING },
      {
        status: TransactionStatus.SUCCESS,
        verifiedAt: dayjs().toDate(),
        autoVerified: true,
      }
    );

    this.logger.info('Transaction verified successfully', {
      context: 'TransactionService',
      channel: transaction.channel,
      reference,
    });

    // try-catch because fulfilling a transaction does not impact
    // the 'verification' of the transaction
    let document: TransactionDocument;

    try {
      document = await this.fulfilTransaction(verifiedDoc);
    } catch (err) {
      this.logger.error('There was an error auto-fulfilling a transaction', {
        context: 'TransactionService',
        errMessage: err.message,
        error: err,
        reference,
      });
    }

    const populatedDoc = await document.populate(searchPopulateOptions);

    // Index new document
    const arr = [populatedDoc.toObject({ virtuals: true })];

    preprocessArrayData(arr, preprocessCallback);

    try {
      await this.searchEngineService.indexSingleDocument(arr[0]);
    } catch (err) {
      this.logger.warn('Error whilst indexing a transaction document', {
        error: err,
        context: 'TransactionService',
      });
    }

    return document;
  }

  async manualVerify(reference: string, userId: string) {
    const transaction = await this.transactionModel.findOne({
      reference,
      status: TransactionStatus.PENDING,
    });

    if (!transaction) {
      throw new AppError(
        'We cannot seem to find that transaction. Please check the reference and try again.',
        HttpStatus.NOT_FOUND
      );
    }

    let newTransactionStatus = TransactionStatus.PENDING;

    if (transaction.channel === PaymentChannels.PAYSTACK) {
      const data = await this.paystackService.verifyTransaction(reference);

      newTransactionStatus =
        (data?.data?.status as TransactionStatus) || TransactionStatus.PENDING;
    }

    if (transaction.channel === PaymentChannels.STRIPE) {
      const data = await this.stripeService.getSessionByReference(reference);

      switch (data.status) {
        case 'expired':
          newTransactionStatus = TransactionStatus.EXPIRED;
          break;
        case 'complete':
          newTransactionStatus = TransactionStatus.SUCCESS;
          break;
        default:
          break;
      }
    }

    if (newTransactionStatus !== TransactionStatus.PENDING) {
      const document = await this.updateTransactionWithFilter(
        { reference, status: TransactionStatus.PENDING },
        {
          status: newTransactionStatus,
          verifiedAt: dayjs().toDate(),
          autoVerified: false,
          verifiedBy: userId,
        }
      );

      const populatedDoc = await document.populate(searchPopulateOptions);

      // Index new document
      const arr = [populatedDoc.toObject({ virtuals: true })];

      preprocessArrayData(arr, preprocessCallback);

      try {
        await this.searchEngineService.indexSingleDocument(arr[0]);
      } catch (err) {
        this.logger.warn('Error whilst indexing a transaction document', {
          error: err,
          context: 'TransactionService',
        });
      }

      return populatedDoc;
    }

    throw new AppError(
      'Nothing new has happened with this transaction',
      HttpStatus.UNPROCESSABLE_ENTITY
    );
  }

  async manualFulfil(reference: string, adminId: string) {
    const transaction = await this.transactionModel.findOne({ reference });

    if (!transaction) {
      throw new AppError(
        'We cannot seem to find that transaction. Please check the reference and try again.',
        HttpStatus.NOT_FOUND
      );
    }

    if (transaction.status !== TransactionStatus.SUCCESS) {
      throw new AppError(
        'You cannot fulfil a unsuccessful transaction.',
        HttpStatus.BAD_REQUEST
      );
    }

    if (transaction.fulfilled) {
      throw new AppError(
        'Transaction has already been fulfilled',
        HttpStatus.BAD_REQUEST
      );
    }

    const newTransaction = await this.fulfilTransaction(transaction, adminId);

    if (!newTransaction) {
      throw new AppError(
        'You cannot fulfil this transaction. Please contact your admin.',
        HttpStatus.BAD_REQUEST
      );
    }

    const populatedDoc = await newTransaction.populate(searchPopulateOptions);

    // Index new document
    const arr = [populatedDoc.toObject({ virtuals: true })];

    preprocessArrayData(arr, preprocessCallback);

    try {
      await this.searchEngineService.indexSingleDocument(arr[0]);
    } catch (err) {
      this.logger.warn('Error whilst indexing a transaction document', {
        error: err,
        context: 'TransactionService',
      });
    }

    return newTransaction;
  }

  async addExternalTransaction(data: SaveExternalTransactionDTO) {
    const transactionId = new Types.ObjectId().toString();

    // save media first
    if (data.media?.length) {
      await this.externalVerificationMediaModel.create({
        transaction: transactionId,
        media: data.media,
      });
    }

    const document = await this.addTransaction({
      _id: transactionId,
      ...data,
    });

    const populatedDoc = await document.populate(searchPopulateOptions);

    // Index new document
    const arr = [populatedDoc.toObject({ virtuals: true })];

    preprocessArrayData(arr, preprocessCallback);

    try {
      await this.searchEngineService.indexSingleDocument(arr[0]);
    } catch (err) {
      this.logger.warn('Error whilst indexing a transaction document', {
        error: err,
        context: 'TransactionService',
      });
    }

    return document;
  }

  async getTransactionMedia(transactionId: string) {
    const document = await this.externalVerificationMediaModel.findOne({
      transaction: transactionId,
    });

    return document;
  }

  async getTransaction(transactionId: string) {
    const transaction = await this.transactionModel
      .findById(transactionId)
      .populate(searchPopulateOptions);

    return transaction;
  }

  @OnEvent(TransactionEventNames.NOTIFY_ADMIN)
  async notifyAdminAboutWalletTopUp({
    name,
    amount,
  }: {
    name: string;
    amount: string;
  }) {
    const dateTime = dayjs().tz(TIMEZONE).format(FULL_DATE);

    this.logger.info('Attempting to notify admins of wallet top up', {
      context: 'TransactionService',
      name,
      amount,
      dateTime,
    });

    const admins = await this.userService.getAllUsers({
      filter_by: 'isActive:=true&&roles:=admin',
    });

    try {
      await Promise.all(
        admins.data.map((el) => {
          return this.notificationProducer.addJob({
            data: {
              userEmail: el.primaryEmail,
              title: 'A client just loaded their wallet',
              body: `${name} just added ${amount} to their wallet`,
            },
          });
        })
      );
    } catch (err) {
      this.logger.error(
        'There was an error notifying admins about wallet top up',
        {
          context: 'TransactionService',
          name,
          amount,
          errorMessage: err.message,
          dateTime,
        }
      );

      return;
    }

    this.logger.info('Successfully notified admins of wallet top up', {
      context: 'TransactionService',
      name,
      amount,
      dateTime,
    });
  }

  async getEarningsBreakdown(query: EarningsBreakdownDTO) {
    const results = await this.transactionModel.aggregate([
      {
        $match: {
          user: new Types.ObjectId(query.user),
          userType: Roles.TUTOR,
          fulfilled: true,
          scope: TransactionScope.TUITION,
        },
      },
      {
        $lookup: {
          from: 'sessions',
          as: 'sessions',
          localField: 'session',
          foreignField: '_id',
          pipeline: [
            {
              $match: {
                startAt: {
                  $gte: dayjs(query.from).toDate(),
                  $lte: dayjs(query.to).toDate(),
                },
              },
            },
            { $project: { _id: 0, tutee: '$tutee' } },
          ],
        },
      },
      { $unwind: '$sessions' },
      {
        $project: {
          _id: 1,
          amount: 1,
          type: 1,
          currency: 1,
          engagement: 1,
          tutee: '$sessions.tutee',
        },
      },
      {
        $lookup: {
          from: 'engagements',
          as: 'engagement',
          localField: 'engagement',
          foreignField: '_id',
          pipeline: [
            {
              $project: {
                _id: 1,
                status: 1,
                type: 1,
                subjects: 1,
                languages: 1,
                exam: 1,
                skills: 1,
                activities: 1,
                specialNeeds: 1,
                startDate: 1,
                endDate: 1,
              },
            },
          ],
        },
      },
      { $unwind: '$engagement' },
      {
        $lookup: {
          from: 'wards',
          as: 'tutee',
          localField: 'tutee',
          foreignField: '_id',
          pipeline: [{ $project: { _id: 0, firstName: 1, lastName: 1 } }],
        },
      },
      { $unwind: '$tutee' },
      { $addFields: { 'engagement.tutee': '$tutee' } },
      { $project: { tutee: 0 } },
      { $sort: { 'engagement.endDate': -1, 'engagement.startDate': -1 } },
    ]);

    const map = new Map<
      string,
      {
        totalDebit: number;
        totalCredit: number;
        tutee: string;
        currency: string;
        id: string;
        status: string;
        taught: string;
        startDate: string;
        endDate: string;
      }
    >();

    let totalDebit = 0;
    let totalCredit = 0;

    for (let i = 0; i < results.length; i++) {
      const result = results[i] as unknown as {
        amount: number;
        engagement: {
          _id: Types.ObjectId;
          status: 'ongoing';
          tutee: { firstName: string; lastName: string };
          type: string;
          subjects?: string[];
          languages?: string[];
          exam?: string;
          skills?: string[];
          activities?: string[];
          specialNeeds?: string[];
          startDate: string;
          endDate: string;
        };
        type: string;
        currency: string;
      };

      const engagementId = result.engagement?._id.toString();

      if (!map.has(engagementId)) {
        const getTaught = () => {
          switch (result.engagement.type) {
            case TutorRequestEnum.ACADEMIC:
              return result.engagement.subjects?.join(', ');
            case TutorRequestEnum.EXTRACURRICULAR:
              return result.engagement.activities?.join(', ');
            case TutorRequestEnum.LANGUAGE:
              return result.engagement.languages?.join(', ');
            case TutorRequestEnum.SOFT_SKILLS:
              return result.engagement.skills?.join(', ');
            case TutorRequestEnum.TEST_EXAM_PREP:
              return result.engagement.exam;
            case TutorRequestEnum.SPECIAL_NEEDS:
              return result.engagement.specialNeeds?.join(', ');
            default:
              return '';
          }
        };

        map.set(engagementId, {
          totalDebit: 0,
          totalCredit: 0,
          tutee: toSentenceCase(
            `${result.engagement.tutee.lastName} ${result.engagement.tutee.firstName}`
          ),
          id: engagementId,
          status: result.engagement.status,
          currency: result.currency,
          taught: getTaught(),
          startDate: result.engagement.startDate,
          endDate: result.engagement.endDate,
        });
      }

      const saved = map.get(engagementId);

      if (result.type === TransactionType.DEBIT) {
        saved.totalDebit = apprAmount(saved.totalDebit + result.amount);
        totalDebit = apprAmount(totalDebit + result.amount);
      }

      if (result.type === TransactionType.CREDIT) {
        saved.totalCredit = apprAmount(saved.totalCredit + result.amount);
        totalCredit = apprAmount(totalCredit + result.amount);
      }
    }

    return { totalDebit, totalCredit, engagements: Array.from(map.values()) };
  }
}
