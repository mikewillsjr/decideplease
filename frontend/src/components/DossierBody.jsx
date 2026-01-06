import ReactMarkdown from 'react-markdown';
import './DossierBody.css';

/**
 * Dossier Body - Contains the chairman's markdown response.
 * CSS transforms the markdown into "legal briefing" style.
 */
export default function DossierBody({
  content,
  isLoading = false,
}) {
  if (isLoading) {
    return (
      <div className="dossier-body loading">
        <div className="loading-skeleton">
          <div className="skeleton-line wide" />
          <div className="skeleton-line medium" />
          <div className="skeleton-line wide" />
          <div className="skeleton-line short" />
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="dossier-body empty">
        <p>Awaiting council verdict...</p>
      </div>
    );
  }

  return (
    <div className="dossier-body">
      <div className="markdown-content dossier-content">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    </div>
  );
}
