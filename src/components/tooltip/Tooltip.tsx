import { JSX } from 'preact';
import './style.css';

type Props = {
  text: string;
  children?: JSX.Element;
};

export const Tooltip = ({ text, children }: Props) => {
  return (
    <span className='tooltip-link' data-tooltip={text}>
      {children}
    </span>
  );
};
