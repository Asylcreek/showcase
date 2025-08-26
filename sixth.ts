import styled from 'styled-components';

export const ProgressReport = styled.div`
  & > *:not(:last-child) {
    margin-bottom: 1.6rem;
  }
`;

export const ProgressReportTutor = styled.p`
  color: rgb(var(--color-neutral5));
`;

export const ProgressReportItem = styled.div`
  border: 1px solid rgb(var(--color-neutral5));
  border-radius: 5px;
  padding: 1.6rem 0;
  color: rgb(var(--color-neutral2));
`;

export const ProgressReportItemHeading = styled.p`
  padding-left: 1.6rem;
  padding-bottom: 2.4rem;
  border-bottom: 1px solid rgb(var(--color-neutral7));
  text-transform: capitalize;
`;

export const ProgressReportItemTable = styled.table<{
  checklist?: boolean;
  $columnWidth?: string;
}>`
  width: 100%;
  color: #272833;
  overflow: hidden;
  border-collapse: collapse;

  & > thead th {
    border-bottom: 1px solid rgb(var(--color-neutral8));
    font-size: 1.2rem;
    font-weight: 600;
    padding: 2rem 1.6rem 1.2rem;
    text-transform: capitalize;

    @media only screen and (max-width: 25em) {
      padding: 2rem 5.5px 1.2rem;
    }

    @media only screen and (min-width: 43.75em) {
      font-size: 1.6rem;
    }
  }

  & > tbody td {
    font-weight: 400;
    font-size: 1.4rem;
    padding: 1.1rem 1.2rem;
    text-align: center;
    ${({ $columnWidth }) => $columnWidth && `width: ${$columnWidth};`}

    &[data-capitalize='true'] {
      text-transform: capitalize;
    }

    & > svg {
      margin-left: 5px;
      height: 1.2rem;
      width: 1.2rem;
      cursor: pointer;
    }

    & [data-link='true'] {
      text-decoration: underline;
      color: rgb(var(--color-primary));
      cursor: pointer;
      background: transparent;
      border: none;
    }

    @media only screen and (max-width: 25em) {
      padding: 1.1rem 5.5px;
    }

    ${({ checklist }) => checklist && 'text-transform: capitalize;'}
  }

  & > tbody td:first-child {
    text-transform: capitalize;

    ${({ checklist }) => checklist && 'text-transform: none;'}
  }

  & > tbody > tr:not(:last-child) {
    border-bottom: 1px solid rgb(var(--color-neutral8));
  }
`;

export const TestScoreItem = styled.td`
  & > span {
    display: block;

    & > svg {
      margin-left: 5px;
      height: 1.2rem;
      width: 1.2rem;
      cursor: pointer;
    }

    &:last-child {
      margin-top: 1rem;

      & > a {
        color: rgb(var(--color-primary));
        text-decoration: underline;
        text-transform: lowercase;
      }
    }
  }
`;

export const ProgressReportItemText = styled.pre`
  padding: 2.4rem 1.6rem 1.2rem;
`;
