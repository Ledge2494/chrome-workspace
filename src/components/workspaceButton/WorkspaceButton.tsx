import './style.css';
import { CSSProperties } from 'preact/compat';

type Props = {
  logo: string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
};

export const WorkspaceButton = ({ logo, onClick, style, className }: Props) => {
  return (
    <article className={`workspace-button ${className ?? ''}`} style={style}>
      <button onClick={onClick}>
        <i className={logo} />
      </button>
    </article>
  );
};
