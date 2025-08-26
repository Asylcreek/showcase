interface ExtendedClientTutorOptionTypes extends SelectOptionType {
  deductibleCurrency?: null;
  earningCurrency?: null;
}
export interface IAddEngagementFormInputValueTypes {
  client: ExtendedClientTutorOptionTypes | null;
  tutee: (SelectOptionType & { curriculum?: string; class?: string }) | null;
  tutor: ExtendedClientTutorOptionTypes | null;
  type: SelectOptionType | null;
  objectivesForClient?: string;
  objectivesForTutor?: string;
  subjects?: SelectOptionType[] | null;
  languages?: SelectOptionType[] | null;
  exam?: SelectOptionType | null;
  skills?: SelectOptionType[] | null;
  activities?: SelectOptionType[] | null;
  specialNeeds?: SelectOptionType[] | null;
  startDate: string;
  endDate: string;
  timezone: SelectOptionType | null;
  days:
    | {
        day: SelectOptionType | null;
        date: string;
        mode: SelectOptionType | null;
        startTime: string;
        duration: SelectOptionType | null;
      }[]
    | null;
  clientCost: {
    currency?: SelectOptionType | null;
    physical: number | undefined;
    virtual: number | undefined;
  };
  tutorCost: {
    currency?: SelectOptionType | null;
    physical: number | undefined;
    virtual: number | undefined;
  };
  frequencyOfReports: SelectOptionType | null;
  additionalInfoForClient?: string;
  additionalInfoForTutor?: string;
  shouldNotifyClient?: SelectOptionType;
  shouldNotifyTutor?: SelectOptionType;
  numOfReportsExpected?: number;
}

type AddEngagementProps = {
  closeSidebar: () => void;
  update?: boolean;
  values?: {
    id?: string;
    client?: { id: string; name: string };
    tutee?: { id: string; name: string };
    tutor?: { id: string; name: string };
    type?: string;
    objectivesForClient?: string;
    objectivesForTutor?: string;
    subjects?: string[];
    languages?: string[];
    exam?: string;
    skills?: string[];
    activities?: string[];
    specialNeeds?: string[];
    startDate?: Date;
    endDate?: Date;
    clientCost?: {
      currency?: string;
      physical: number | undefined;
      virtual: number | undefined;
    };
    tutorCost?: {
      currency?: string;
      physical: number | undefined;
      virtual: number | undefined;
    };
    frequencyOfReports?: string;
    additionalInfoForClient?: string;
    additionalInfoForTutor?: string;
    timezone: string;
    days?: {
      day: string;
      date: string;
      mode: string;
      startTime: string;
      duration: string;
    }[];
    isPhysicalClass?: boolean;
    isVirtualClass?: boolean;
    numOfReportsExpected?: number;
  };
  requestId?: string;
};

export const typeOptions = [
  { value: TutorRequestTypes.ACADEMIC, label: 'Academic' },
  { value: TutorRequestTypes.LANGUAGE, label: 'Language' },
  { value: TutorRequestTypes.TEST_EXAM_PREP, label: 'Test / Exam' },
  { value: TutorRequestTypes.SOFT_SKILLS, label: 'Soft skills' },
  { value: TutorRequestTypes.EXTRACURRICULAR, label: 'Extracurricular' },
  { value: TutorRequestTypes.SPECIAL_NEEDS, label: 'Special Needs' },
];

const generateEngagementDays = (
  startDate: string,
  endDate: string,
  timezone: string,
  days: {
    day?: SelectOptionType | null;
    date?: string;
    mode: SelectOptionType | null;
    startTime: string;
    duration: SelectOptionType | null;
  }[],
  isManual: boolean,
  returnUTC = false
) => {
  if (isManual) {
    return days.map((day) => {
      const date = dayjs(day.date);
      let startDatetime = dayjs(
        date.format(DATE_FORMAT) + ' ' + day.startTime
      ).format(FORM_DATE_TIME_FORMAT);

      const duration = day.duration?.value.split(' ')[0];

      let endDatetime = dayjs(startDatetime)
        .add(Number(duration), 'hour')
        .format(FORM_DATE_TIME_FORMAT);

      if (returnUTC) {
        startDatetime = convertToUTC(startDatetime, timezone);
        endDatetime = convertToUTC(endDatetime, timezone);
      }

      return {
        startDatetime,
        endDatetime,
        modeOfClass: day.mode?.value || '',
      };
    });
  }

  return getEngagementDays(
    startDate,
    endDate,
    timezone,
    days?.map(({ day, mode, startTime, duration }) => ({
      day: day?.value as string,
      mode: mode?.value as string,
      startTime,
      duration: duration?.value as string,
    })) as {
      day: string;
      mode: string;
      startTime: string;
      duration: string;
    }[],
    returnUTC
  );
};

const convertDaysToDates = (
  days: {
    startDatetime: string;
    endDatetime: string;
    modeOfClass: string;
  }[]
) => {
  return days.map((item) => {
    const date = dayjs(item.startDatetime).format(DATE_FORMAT);
    const startTime = dayjs(item.startDatetime).format(TIME_FORMAT);
    const duration = durationOptions.find((el) =>
      el.value.startsWith(
        dayjs(item.endDatetime)
          .diff(dayjs(item.startDatetime), 'hour', true)
          .toString()
      )
    ) || { value: '', label: '' };

    return {
      day: null,
      date,
      mode: {
        label: item.modeOfClass,
        value: item.modeOfClass,
      },
      startTime,
      duration,
    };
  });
};

const AddEngagement: FC<AddEngagementProps> = ({
  closeSidebar,
  update,
  values,
  requestId,
}) => {
  const daysContainerRef = useRef<HTMLDivElement>(null);

  const router = useRouter();

  const [isManual, setIsManual] = useState(false);

  const tz = useTZ();
  const toTZ = useToTZ();

  const defaultValues = {
    client: values?.client
      ? { value: values?.client?.id, label: values?.client?.name }
      : null,
    tutee: values?.tutee
      ? { value: values?.tutee?.id, label: values?.tutee?.name }
      : null,
    tutor: values?.tutor
      ? { value: values?.tutor?.id, label: values?.tutor?.name }
      : null,
    objectivesForClient: values?.objectivesForClient ?? '',
    objectivesForTutor: values?.objectivesForTutor ?? '',
    startDate: values?.startDate
      ? tz(values?.startDate).format(DATE_FORMAT)
      : '',
    endDate: values?.endDate ? tz(values?.endDate).format(DATE_FORMAT) : '',
    timezone: values?.timezone
      ? { value: values?.timezone, label: values?.timezone }
      : null,
    days: values?.days
      ? values?.days?.map((el) => ({
          day: { value: el.day, label: el.day },
          date: tz(el.date).format(DATE_FORMAT),
          mode: { value: el.mode, label: el.mode },
          startTime: tz(tz().format(DATE_FORMAT) + el.startTime).format(
            TIME_FORMAT
          ),
          duration: { value: el.duration, label: el.duration },
        }))
      : [{ day: null, date: '', mode: null, startTime: '', duration: null }],
    type: values?.type ? { value: values?.type, label: values?.type } : null,
    subjects:
      values?.type === TutorRequestTypes.ACADEMIC
        ? values?.subjects?.map((subject) => ({
            value: subject,
            label: subject,
          }))
        : null,
    languages:
      values?.type === TutorRequestTypes.LANGUAGE
        ? values?.languages?.map((subject) => ({
            value: subject,
            label: subject,
          }))
        : null,
    exam:
      values?.type === TutorRequestTypes.TEST_EXAM_PREP
        ? {
            value: values?.exam,
            label: values?.exam,
          }
        : null,
    skills:
      values?.type === TutorRequestTypes.SOFT_SKILLS
        ? values?.skills?.map((subject) => ({
            value: subject,
            label: subject,
          }))
        : null,
    activities:
      values?.type === TutorRequestTypes.EXTRACURRICULAR
        ? values?.activities?.map((subject) => ({
            value: subject,
            label: subject,
          }))
        : null,
    specialNeeds:
      values?.type === TutorRequestTypes.SPECIAL_NEEDS
        ? values?.specialNeeds?.map((subject) => ({
            value: subject,
            label: subject,
          }))
        : null,
    clientCost: {
      currency: values?.clientCost?.currency
        ? {
            value: values?.clientCost?.currency,
            label: values?.clientCost?.currency,
          }
        : null,
      physical: values?.clientCost?.physical ?? undefined,
      virtual: values?.clientCost?.virtual ?? undefined,
    },
    tutorCost: {
      currency: values?.tutorCost?.currency
        ? {
            value: values?.tutorCost?.currency,
            label: values?.tutorCost?.currency,
          }
        : null,
      physical: values?.tutorCost?.physical ?? undefined,
      virtual: values?.tutorCost?.virtual ?? undefined,
    },
    frequencyOfReports: {
      value: values?.frequencyOfReports || 'monthly',
      label: values?.frequencyOfReports || 'Monthly',
    },
    additionalInfoForClient: values?.additionalInfoForClient ?? '',
    additionalInfoForTutor: values?.additionalInfoForTutor ?? '',
    shouldNotifyClient: { value: 'yes', label: 'Yes' },
    shouldNotifyTutor: { value: 'yes', label: 'Yes' },
    numOfReportsExpected: values?.numOfReportsExpected ?? undefined,
  };

  const {
    control,
    handleSubmit,
    formState: { errors },
    register,
    trigger,
    watch,
    setValue,
    setError,
    setFocus,
  } = useForm<IAddEngagementFormInputValueTypes>({
    defaultValues,
  });

  const {
    fields,
    append,
    update: updateField,
    remove,
    insert,
  } = useFieldArray({
    control,
    name: 'days',
  });

  const client = watch('client');
  const startDate = watch('startDate');
  const endDate = watch('endDate');
  const type = watch('type');
  const tutee = watch('tutee');
  const days = watch('days');
  const timezone = watch('timezone');

  const isPhysicalClass =
    values?.isPhysicalClass ??
    !!days?.find((el) => el.mode?.value.toLowerCase() === 'physical');
  const isVirtualClass =
    values?.isVirtualClass ??
    !!days?.find((el) => el.mode?.value.toLowerCase() === 'virtual');

  const { data: wards, isLoading: isGettingWards } = useGetWards(
    client?.value as string
  );

  const {
    mutate: addEngagement,
    isPending: isAddingEngagement,
    error,
  } = useAddEngagement(closeSidebar);

  const { mutate: updateEngagement, isPending: isUpdatingEngagement } =
    useUpdateEngagement(values?.id as string, closeSidebar);

  const clashes =
    (
      error as AxiosError<{
        errors: Array<Clash>;
      }>
    )?.response?.data?.errors || [];

  const onSubmit: SubmitHandler<IAddEngagementFormInputValueTypes> = (data) => {
    if (isPhysicalClass && !data.clientCost.physical) {
      setError('clientCost.physical', { message: 'This field is required' });
      setFocus('clientCost.physical');
    }

    if (isPhysicalClass && !data.tutorCost.physical) {
      setError('tutorCost.physical', { message: 'This field is required' });
      setFocus('tutorCost.physical');
    }

    if (isVirtualClass && !data.clientCost.virtual) {
      setError('clientCost.virtual', { message: 'This field is required' });
      setFocus('clientCost.virtual');
    }

    if (isVirtualClass && !data.tutorCost.virtual) {
      setError('tutorCost.physical', { message: 'This field is required' });
      setFocus('tutorCost.physical');
    }

    if (!isPhysicalClass) {
      data.clientCost.physical = undefined;
      data.tutorCost.physical = undefined;
    }

    if (!isVirtualClass) {
      data.clientCost.virtual = undefined;
      data.tutorCost.virtual = undefined;
    }

    const payload = {
      ...data,
      startDate: convertToUTC(data.startDate, data?.timezone?.value as string),
      endDate: convertToUTC(data.endDate, data?.timezone?.value as string),
      clientCost: undefined,
      tutorCost: undefined,
      client: data.client?.value as string,
      tutee: data.tutee?.value as string,
      tutor: data.tutor?.value,
      type: data.type?.value as string,
      subjects: data.subjects?.map(({ value }) => value),
      languages: data.languages?.map(({ value }) => value),
      skills: data.skills?.map(({ value }) => value),
      exam: data.exam?.value,
      activities: data.activities?.map(({ value }) => value),
      specialNeeds: data.specialNeeds?.map(({ value }) => value),
      timezone: data.timezone?.value,
      days: !update
        ? generateEngagementDays(
            data?.startDate,
            data?.endDate,
            data?.timezone?.value as string,
            data?.days || [],
            isManual,
            true
          )
        : undefined,
      costsPerHour: {
        client: {
          currency: data.clientCost.currency?.value as string,
          physical: isPhysicalClass
            ? Number(data.clientCost.physical)
            : undefined,
          virtual: isVirtualClass ? Number(data.clientCost.virtual) : undefined,
        },
        tutor: {
          currency: data.tutorCost.currency?.value as string,
          physical: isPhysicalClass
            ? Number(data.tutorCost.physical)
            : undefined,
          virtual: isVirtualClass ? Number(data.tutorCost.virtual) : undefined,
        },
      },
      frequencyOfReports: data?.frequencyOfReports?.value as string,
      tutorRequest: requestId,
      objectivesForClient: xss(data.objectivesForClient || ''),
      objectivesForTutor: xss(data.objectivesForTutor || ''),
      additionalInfoForClient: xss(data.additionalInfoForClient || ''),
      additionalInfoForTutor: xss(data.additionalInfoForTutor || ''),
      numOfReportsExpected: Number(data.numOfReportsExpected),
    };

    if (update) {
      console.log(payload);
      return;
      updateEngagement({
        ...payload,
        client: undefined,
        tutor: undefined,
        shouldNotifyClient: data.shouldNotifyClient?.value === 'yes',
        shouldNotifyTutor: data.shouldNotifyTutor?.value === 'yes',
        days: undefined,
        startDate: toTZ(data.startDate).toISOString(),
        endDate: toTZ(data.endDate).toISOString(),
      });

      return;
    }

    addEngagement(payload);
  };

  const addDay = () =>
    append({ mode: null, day: null, date: '', startTime: '', duration: null });

  const tuteeOptions = wards?.data?.map((ward) => ({
    value: ward?.id,
    label: `${ward?.lastName} ${ward?.firstName}`,
    curriculum: ward?.curriculum,
    class: ward?.class,
  }));

  const tuteeSubjects =
    tutee?.curriculum && tutee?.class
      ? subjects[tutee?.curriculum][tutee?.class]
      : [];

  const gotoClient = () => {
    closeSidebar();

    router.push(routes.client(client?.value as string));
  };

  const gotoWard = () => {
    closeSidebar();

    router.push(routes.ward(client?.value as string, tutee?.value as string));
  };

  // Add curriculum and class to tutee form input value
  useEffect(() => {
    const clientWards = wards?.data;

    if (values?.tutee && clientWards?.length) {
      const currentTutee = clientWards.find((el) => el.id === values.tutee?.id);

      setValue('tutee', {
        value: String(values.tutee.id),
        label: values.tutee.name,
        curriculum: currentTutee?.curriculum,
        class: currentTutee?.class,
      });
    }
  }, [values?.tutee, setValue, wards?.data]);

  useEffect(() => {
    if (clashes?.length) {
      daysContainerRef?.current?.scrollIntoView();
    }
  }, [clashes?.length]);

  const resetDays = () => {
    setValue('days', [
      {
        day: null,
        date: '',
        mode: null,
        startTime: '',
        duration: null,
      },
    ]);
  };

  const startDateRegister = register('startDate', { required: 'Enter a date' });
  const endDateRegister = register('endDate', {
    required: 'Enter a date',
    min: {
      value: startDate,
      message: 'End date must be after start date',
    },
  });

  return (
    <Form onSubmit={handleSubmit(onSubmit)}>
      <FormInputContainer $isInputInvalid={!!errors?.client}>
        <label htmlFor="client">
          Client<span>*</span>
        </label>

        <Controller
          name="client"
          control={control}
          rules={{ required: 'Please select one...' }}
          render={({ field, fieldState: { error } }) => (
            <AsyncSelect
              inputRef={field.ref}
              name="client"
              id="client"
              loadOptions={loadUsersByRole('client')}
              error={error}
              value={field.value}
              onChange={(val) => {
                setValue('tutee', null);

                field.onChange(val);
                const newValue = val as ExtendedClientTutorOptionTypes;
                if (newValue?.deductibleCurrency) {
                  setValue('clientCost.currency', {
                    value: newValue.deductibleCurrency,
                    label: newValue.deductibleCurrency,
                  });
                }

                setValue('clientCost.physical', undefined);
                setValue('clientCost.virtual', undefined);
              }}
              onBlur={field.onBlur}
              placeholder="Search first name, last name, email..."
              isClearable
              noOptionsMessage={({ inputValue }: { inputValue: string }) =>
                `No active clients with query: ${inputValue}`
              }
              isDisabled={update}
            />
          )}
        />

        {update && (
          <InputFooterText text="You cannot change the client" noError />
        )}
      </FormInputContainer>

      <FormInputContainer $isInputInvalid={!!errors?.tutee}>
        <label htmlFor="tutee">
          Tutee<span>*</span>
        </label>

        <Controller
          name="tutee"
          control={control}
          rules={{ required: 'Please select one...' }}
          render={({ field, fieldState: { error } }) => (
            <Select
              inputRef={field.ref}
              name="tutee"
              id="tutee"
              options={tuteeOptions ?? []}
              error={error}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              isSearchable
              isDisabled={!client || isGettingWards}
              placeholder={
                isGettingWards
                  ? `Getting ${client?.label}'s wards...`
                  : client
                    ? 'Select one...'
                    : 'Please select a client'
              }
              noOptionsMessage={() => (
                <p>
                  {client?.label} has no wards. Click{' '}
                  <span
                    style={{ textDecoration: 'underline', cursor: 'pointer' }}
                    onClick={gotoClient}
                  >
                    here
                  </span>{' '}
                  to add a ward
                </p>
              )}
            />
          )}
        />
      </FormInputContainer>

      <FormInputContainer $isInputInvalid={!!errors?.tutor}>
        <label htmlFor="tutor">
          Tutor<span>*</span>
        </label>

        <Controller
          name="tutor"
          rules={{ required: 'Please select one...' }}
          control={control}
          render={({ field, fieldState: { error } }) => (
            <AsyncSelect
              inputRef={field.ref}
              name="tutor"
              id="tutor"
              loadOptions={loadUsersByRole('tutor')}
              error={error}
              value={field.value}
              onChange={(value) => {
                field.onChange(value);
                const newValue = value as ExtendedClientTutorOptionTypes;
                if (newValue?.earningCurrency) {
                  setValue('tutorCost.currency', {
                    value: newValue.earningCurrency,
                    label: newValue.earningCurrency,
                  });
                }

                setValue('tutorCost.physical', undefined);
                setValue('tutorCost.virtual', undefined);
              }}
              onBlur={field.onBlur}
              isClearable
              placeholder="Search first name, last name, email..."
              noOptionsMessage={({ inputValue }: { inputValue: string }) =>
                `No active tutors with query: ${inputValue}`
              }
              isDisabled={update}
            />
          )}
        />

        {update && (
          <InputFooterText noError text="You cannot change the tutor" />
        )}
      </FormInputContainer>

      <ShowView when={!update}>
        <FormInputContainer $isInputInvalid={!!errors?.timezone}>
          <label htmlFor="timezone">
            Timezone<span>*</span>
          </label>

          <Controller
            name="timezone"
            control={control}
            rules={{ required: 'Please select timezone' }}
            render={({ field, fieldState: { error } }) => (
              <Select
                inputRef={field.ref}
                id="timezone"
                options={timezoneSelectOptions}
                value={field.value}
                onChange={field.onChange}
                error={error}
                isSearchable
              />
            )}
          />

          {!errors?.timezone && (
            <InputFooterText text="The timezone for this engagement" noError />
          )}
        </FormInputContainer>
      </ShowView>

      <FormGroup>
        <FormInputContainer $isInputInvalid={!!errors?.startDate}>
          <label htmlFor="startDate">
            Start date<span>*</span>
          </label>

          <input
            type="date"
            id="startDate"
            {...startDateRegister}
            onChange={(e) => {
              startDateRegister.onChange(e);

              if (isManual) resetDays();
            }}
          />

          {errors?.startDate && (
            <InputFooterText text={errors?.startDate?.message as string} />
          )}
        </FormInputContainer>

        <FormInputContainer $isInputInvalid={!!errors?.endDate}>
          <label htmlFor="endDate">
            End date<span>*</span>
          </label>

          <input
            type="date"
            id="endDate"
            min={startDate}
            {...endDateRegister}
            onChange={(e) => {
              endDateRegister.onChange(e);
              if (isManual) resetDays();
            }}
          />

          {errors?.endDate && (
            <InputFooterText text={errors?.endDate?.message as string} />
          )}
        </FormInputContainer>
      </FormGroup>

      <FormInputContainer $isInputInvalid={!!errors?.type}>
        <label htmlFor="type">
          Engagement Type<span>*</span>
        </label>

        <Controller
          name="type"
          control={control}
          rules={{ required: 'Please select one...' }}
          render={({ field, fieldState: { error } }) => (
            <Select
              inputRef={field.ref}
              name="type"
              id="type"
              options={typeOptions}
              error={error}
              value={field.value}
              onChange={(val) => {
                setValue('subjects', null);
                setValue('languages', null);
                setValue('skills', null);
                setValue('exam', null);
                setValue('activities', null);
                setValue('specialNeeds', null);

                field.onChange(val);
              }}
              onBlur={field.onBlur}
            />
          )}
        />
      </FormInputContainer>

      <ShowView when={type?.value === TutorRequestTypes.ACADEMIC}>
        <FormInputContainer $isInputInvalid={!!errors?.subjects}>
          <label htmlFor="subjects">
            Subjects<span>*</span>
          </label>

          <Controller
            name="subjects"
            control={control}
            rules={{ required: 'Please select one or more...' }}
            render={({ field, fieldState: { error } }) => (
              <Select
                inputRef={field.ref}
                name="subjects"
                id="subjects"
                options={tuteeSubjects}
                error={error}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isDisabled={!tutee}
                isSearchable
                isMulti
                placeholder={
                  !tutee ? 'Please select a tutee' : 'Select one or more ...'
                }
                noOptionsMessage={() => {
                  return tuteeSubjects.length ? (
                    <p>No options</p>
                  ) : (
                    <p>
                      {tutee?.label} doesn't have a curriculum/class. Click{' '}
                      <span
                        style={{
                          textDecoration: 'underline',
                          cursor: 'pointer',
                        }}
                        onClick={gotoWard}
                      >
                        here
                      </span>{' '}
                      to update {tutee?.label}'s curriculum/class
                    </p>
                  );
                }}
              />
            )}
          />
        </FormInputContainer>
      </ShowView>

      <ShowView when={type?.value === TutorRequestTypes.LANGUAGE}>
        <FormInputContainer $isInputInvalid={!!errors?.languages}>
          <label htmlFor="languages">
            Languages<span>*</span>
          </label>

          <Controller
            name="languages"
            control={control}
            rules={{ required: 'Please select one or more...' }}
            render={({ field, fieldState: { error } }) => (
              <Select
                inputRef={field.ref}
                name="languages"
                id="languages"
                options={languages}
                error={error}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isSearchable
                isMulti
                placeholder="Select one or more ..."
              />
            )}
          />
        </FormInputContainer>
      </ShowView>

      <ShowView when={type?.value === TutorRequestTypes.SOFT_SKILLS}>
        <FormInputContainer $isInputInvalid={!!errors?.skills}>
          <label htmlFor="skills">
            Soft skills<span>*</span>
          </label>

          <Controller
            name="skills"
            control={control}
            rules={{ required: 'Please select one or more...' }}
            render={({ field, fieldState: { error } }) => (
              <Select
                inputRef={field.ref}
                name="skills"
                id="skills"
                options={skills}
                error={error}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isSearchable
                isMulti
                placeholder="Select one or more ..."
              />
            )}
          />
        </FormInputContainer>
      </ShowView>

      <ShowView when={type?.value === TutorRequestTypes.TEST_EXAM_PREP}>
        <FormInputContainer $isInputInvalid={!!errors?.exam}>
          <label htmlFor="exam">
            Exam / Test<span>*</span>
          </label>

          <Controller
            name="exam"
            control={control}
            rules={{ required: 'Please select one ...' }}
            render={({ field, fieldState: { error } }) => (
              <Select
                inputRef={field.ref}
                name="exam"
                id="exam"
                options={exams}
                error={error}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isSearchable
                placeholder="Select one ..."
              />
            )}
          />
        </FormInputContainer>
      </ShowView>

      <ShowView when={type?.value === TutorRequestTypes.EXTRACURRICULAR}>
        <FormInputContainer $isInputInvalid={!!errors?.activities}>
          <label htmlFor="activities">
            Extracurriculars<span>*</span>
          </label>

          <Controller
            name="activities"
            control={control}
            rules={{ required: 'Please select one or more...' }}
            render={({ field, fieldState: { error } }) => (
              <Select
                inputRef={field.ref}
                name="activities"
                id="activities"
                options={activities}
                error={error}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isSearchable
                isMulti
                placeholder="Select one or more ..."
              />
            )}
          />
        </FormInputContainer>
      </ShowView>

      <ShowView when={type?.value === TutorRequestTypes.SPECIAL_NEEDS}>
        <FormInputContainer $isInputInvalid={!!errors?.specialNeeds}>
          <label htmlFor="specialNeeds">
            Special Needs<span>*</span>
          </label>

          <Controller
            name="specialNeeds"
            control={control}
            rules={{ required: 'Please select one or more...' }}
            render={({ field, fieldState: { error } }) => (
              <Select
                inputRef={field.ref}
                name="specialNeeds"
                id="specialNeeds"
                options={specialNeeds}
                error={error}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isSearchable
                isMulti
                placeholder="Select one or more ..."
              />
            )}
          />
        </FormInputContainer>
      </ShowView>

      <ShowView
        when={
          type?.value !== TutorRequestTypes.TEST_EXAM_PREP &&
          type?.value !== TutorRequestTypes.SPECIAL_NEEDS
        }
      >
        <FormInputContainer $isInputInvalid={!!errors?.objectivesForClient}>
          <label htmlFor="objectivesForClient">
            Objectives for client<span>*</span>
          </label>

          <Controller
            name="objectivesForClient"
            control={control}
            rules={{
              required:
                type?.value !== TutorRequestTypes.TEST_EXAM_PREP &&
                type?.value !== TutorRequestTypes.SPECIAL_NEEDS
                  ? 'This field is required'
                  : false,
            }}
            render={({ field, fieldState: { error } }) => (
              <DynamicRTE
                id="objectivesForClient"
                inputRef={field.ref}
                error={error}
                value={field.value}
                onChange={(value) => {
                  if (value === '<p></p>') {
                    field.onChange('');

                    return;
                  }

                  field.onChange(value);
                }}
                onBlur={field.onBlur}
              />
            )}
          />
        </FormInputContainer>

        <FormInputContainer $isInputInvalid={!!errors?.objectivesForTutor}>
          <label htmlFor="objectivesForTutor">
            Objectives for tutor<span>*</span>
          </label>

          <Controller
            name="objectivesForTutor"
            control={control}
            rules={{
              required:
                type?.value !== TutorRequestTypes.TEST_EXAM_PREP &&
                type?.value !== TutorRequestTypes.SPECIAL_NEEDS
                  ? 'This field is required'
                  : false,
            }}
            render={({ field, fieldState: { error } }) => (
              <DynamicRTE
                id="objectivesForTutor"
                inputRef={field.ref}
                error={error}
                value={field.value}
                onChange={(value) => {
                  if (value === '<p></p>') {
                    field.onChange('');

                    return;
                  }

                  field.onChange(value);
                }}
                onBlur={field.onBlur}
              />
            )}
          />
        </FormInputContainer>
      </ShowView>

      <ShowView when={!update}>
        <DaysContainer ref={daysContainerRef}>
          <DaysTitleButtonContainer>
            <p>Days</p>

            <DaysButtonContainer onClick={addDay}>
              <span>
                <SvgIcon iconName="plus" />
              </span>

              <p>Add day</p>
            </DaysButtonContainer>
          </DaysTitleButtonContainer>

          {fields.map((item, index) => (
            <DayItem
              key={item.id}
              item={item}
              itemsCount={fields.length}
              index={index}
              update={updateField}
              remove={remove}
              insert={insert}
              control={control}
              trigger={trigger}
              register={register}
              manual={isManual}
              startDate={startDate}
              endDate={endDate}
            />
          ))}

          <ShowView when={!!fields[0]?.day && !!startDate && !!endDate}>
            <ToggleButton
              onClick={() => {
                if (!days) return;
                const engagementDays = generateEngagementDays(
                  startDate,
                  endDate,
                  timezone?.value as string,
                  days.map(({ day, date, mode, startTime, duration }) => ({
                    day: day,
                    date: date,
                    mode: mode,
                    startTime: startTime,
                    duration: duration,
                  })),
                  isManual
                );
                setValue('days', convertDaysToDates(engagementDays));
                setIsManual(true);
              }}
              $transparentBg
              type="button"
            >
              Switch to manual
            </ToggleButton>
          </ShowView>

          <ShowView when={clashes.length > 0}>
            <ClashErrors clashes={clashes} />
          </ShowView>
        </DaysContainer>
      </ShowView>

      <FormInputContainer $isInputInvalid={!!errors?.numOfReportsExpected}>
        <label htmlFor="numOfReportsExpected">
          How many reports are you expecting?<span>*</span>
        </label>

        <input
          type="number"
          id="numOfReportsExpected"
          min={0}
          {...register('numOfReportsExpected', {
            required: 'Please enter a value',
            min: { value: 0, message: 'Value cannot be less than 0' },
          })}
        />

        {errors?.numOfReportsExpected && (
          <InputFooterText
            text={errors?.numOfReportsExpected?.message as string}
          />
        )}
      </FormInputContainer>

      <FormInputContainer $isInputInvalid={!!errors?.frequencyOfReports}>
        <label htmlFor="frequencyOfReports">
          Frequency of reports<span>*</span>
        </label>

        <Controller
          name="frequencyOfReports"
          control={control}
          rules={{ required: 'Please select one...' }}
          render={({ field, fieldState: { error } }) => (
            <Select
              inputRef={field.ref}
              name="frequencyOfReports"
              id="frequencyOfReports"
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'weekly', label: 'Weekly' },
              ]}
              error={error}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />
      </FormInputContainer>

      <FormInputContainer $isInputInvalid={!!errors?.additionalInfoForClient}>
        <label htmlFor="additionalInfoForClient">
          Additional info for client
        </label>

        <Controller
          name="additionalInfoForClient"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <DynamicRTE
              id="additionalInfoForClient"
              inputRef={field.ref}
              error={error}
              value={field.value}
              onChange={(value) => {
                if (value === '<p></p>') {
                  field.onChange('');

                  return;
                }

                field.onChange(value);
              }}
              onBlur={field.onBlur}
            />
          )}
        />
      </FormInputContainer>

      <FormInputContainer $isInputInvalid={!!errors?.additionalInfoForTutor}>
        <label htmlFor="additionalInfoForTutor">
          Additional info for tutor
        </label>

        <Controller
          name="additionalInfoForTutor"
          control={control}
          render={({ field, fieldState: { error } }) => (
            <DynamicRTE
              id="additionalInfoForTutor"
              inputRef={field.ref}
              error={error}
              value={field.value}
              onChange={(value) => {
                if (value === '<p></p>') {
                  field.onChange('');

                  return;
                }

                field.onChange(value);
              }}
              onBlur={field.onBlur}
            />
          )}
        />
      </FormInputContainer>

      <DaysContainer>
        <DaysTitleButtonContainer>
          <p>Client Cost / Hr</p>
        </DaysTitleButtonContainer>

        <FormInputContainer $isInputInvalid={!!errors?.clientCost?.currency}>
          <label htmlFor="clientCost.currency">
            Currency<span>*</span>
          </label>

          <Controller
            name="clientCost.currency"
            control={control}
            rules={{ required: 'Please select a currency' }}
            render={({ field, fieldState: { error } }) => (
              <Select
                inputRef={field.ref}
                name="clientCost.currency"
                id="clientCost.currency"
                options={clientCurrencySelectOptions}
                error={error}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isDisabled={true}
                placeholder="Please select a client first"
              />
            )}
          />
        </FormInputContainer>

        <FormGroup>
          <FormInputContainer $isInputInvalid={!!errors?.clientCost?.physical}>
            <label htmlFor="clientCost.physical">
              Physical{isPhysicalClass ? <span>*</span> : null}
            </label>

            <input
              type="number"
              id="clientCost.physical"
              step="0.01"
              {...register('clientCost.physical', {
                required: isPhysicalClass ? 'Please enter a cost' : false,
                pattern: {
                  value: VALID_PRICE_REGEX,
                  message: 'Amount cannot have more than 2 decimal places',
                },
              })}
              disabled={update}
            />

            {errors?.clientCost?.physical && (
              <InputFooterText
                text={errors?.clientCost?.physical?.message as string}
              />
            )}
          </FormInputContainer>

          <FormInputContainer $isInputInvalid={!!errors?.clientCost?.virtual}>
            <label htmlFor="clientCost.virtual">
              Virtual{isVirtualClass ? <span>*</span> : null}
            </label>

            <input
              type="number"
              id="clientCost.virtual"
              step="0.01"
              {...register('clientCost.virtual', {
                required: isVirtualClass ? 'Please enter a cost' : false,
                pattern: {
                  value: VALID_PRICE_REGEX,
                  message: 'Amount cannot have more than 2 decimal places',
                },
              })}
              disabled={update}
            />

            {errors?.clientCost?.virtual && (
              <InputFooterText
                text={errors?.clientCost?.virtual?.message as string}
              />
            )}
          </FormInputContainer>
        </FormGroup>
      </DaysContainer>

      <DaysContainer>
        <DaysTitleButtonContainer>
          <p>Tutor Cost / Hr</p>
        </DaysTitleButtonContainer>

        <FormInputContainer $isInputInvalid={!!errors?.tutorCost?.currency}>
          <label htmlFor="tutorCost.currency">
            Currency<span>*</span>
          </label>

          <Controller
            name="tutorCost.currency"
            control={control}
            rules={{ required: 'Please select a currency' }}
            render={({ field, fieldState: { error } }) => (
              <Select
                inputRef={field.ref}
                name="tutorCost.currency"
                id="tutorCost.currency"
                options={tutorCurrencySelectOptions}
                error={error}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                isDisabled={true}
                placeholder="Please select a tutor first"
              />
            )}
          />
        </FormInputContainer>

        <FormGroup>
          <FormInputContainer $isInputInvalid={!!errors?.tutorCost?.physical}>
            <label htmlFor="tutorCost.physical">
              Physical{isPhysicalClass ? <span>*</span> : null}
            </label>

            <input
              type="number"
              step="0.01"
              id="tutorCost.physical"
              {...register('tutorCost.physical', {
                required: isPhysicalClass ? 'Please enter a cost' : false,
                pattern: {
                  value: VALID_PRICE_REGEX,
                  message: 'Amount cannot have more than 2 decimal places',
                },
              })}
              disabled={update}
            />

            {errors?.tutorCost?.physical && (
              <InputFooterText
                text={errors?.tutorCost?.physical?.message as string}
              />
            )}
          </FormInputContainer>

          <FormInputContainer $isInputInvalid={!!errors?.tutorCost?.virtual}>
            <label htmlFor="tutorCost.virtual">
              Virtual{isVirtualClass ? <span>*</span> : null}
            </label>

            <input
              type="number"
              step="0.01"
              id="tutorCost.virtual"
              {...register('tutorCost.virtual', {
                required: isVirtualClass ? 'Please enter a cost' : false,
                pattern: {
                  value: VALID_PRICE_REGEX,
                  message: 'Amount cannot have more than 2 decimal places',
                },
              })}
              disabled={update}
            />

            {errors?.tutorCost?.virtual && (
              <InputFooterText
                text={errors?.tutorCost?.virtual?.message as string}
              />
            )}
          </FormInputContainer>
        </FormGroup>
      </DaysContainer>

      <ShowView when={!!update}>
        <FormInputContainer
          style={{ marginTop: '3.2rem' }}
          $isInputInvalid={!!errors?.shouldNotifyClient}
        >
          <label htmlFor="shouldNotifyClient">
            Notify client?<span>*</span>
          </label>

          <Controller
            name="shouldNotifyClient"
            control={control}
            rules={{ required: update ? 'Please select one...' : false }}
            render={({ field, fieldState: { error } }) => (
              <Select
                inputRef={field.ref}
                name="shouldNotifyClient"
                id="shouldNotifyClient"
                options={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' },
                ]}
                error={error}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />

          {!errors?.shouldNotifyClient && (
            <InputFooterText
              text="Should the client be notified of the change?"
              noError
            />
          )}
        </FormInputContainer>

        <FormInputContainer $isInputInvalid={!!errors?.shouldNotifyTutor}>
          <label htmlFor="shouldNotifyTutor">
            Notify tutor?<span>*</span>
          </label>

          <Controller
            name="shouldNotifyTutor"
            control={control}
            rules={{ required: update ? 'Please select one...' : false }}
            render={({ field, fieldState: { error } }) => (
              <Select
                inputRef={field.ref}
                name="shouldNotifyTutor"
                id="shouldNotifyTutor"
                options={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' },
                ]}
                error={error}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
              />
            )}
          />

          {!errors?.shouldNotifyTutor && (
            <InputFooterText
              text="Should the tutor be notified of the change?"
              noError
            />
          )}
        </FormInputContainer>
      </ShowView>

      <Button $block isLoading={isAddingEngagement || isUpdatingEngagement}>
        Save
      </Button>
    </Form>
  );
};

export default AddEngagement;
