import ReactMarkdown from 'react-markdown';
import CollapsibleStage from './CollapsibleStage';
import Stage1 from './Stage1';
import Stage1_5 from './Stage1_5';
import Stage2 from './Stage2';
import './VerdictDossier.css';

/**
 * Verdict Dossier - Shows the final answer with collapsible access to all stages.
 * Simplified: no chrome/labels, just the raw response with stage access.
 */
export default function VerdictDossier({
  question,
  stage1,
  stage1_5,
  stage2,
  stage3,
  metadata = {},
  isLoading = false,
}) {
  const {
    aggregate_rankings: aggregateRankings,
    label_to_model: labelToModel,
    stage2Skipped,
    stage1_5Skipped,
    mode,
  } = metadata;

  const stage3Content = stage3?.response || '';
  const hasStage1 = stage1 && stage1.length > 0;
  const hasStage1_5 = stage1_5 && stage1_5.length > 0 && !stage1_5Skipped;
  const hasStage2 = stage2 && stage2.length > 0 && !stage2Skipped;

  return (
    <div className={`verdict-dossier ${isLoading ? 'loading' : ''}`}>
      {/* Question at the top */}
      {question && (
        <div className="verdict-question">
          <div className="question-text">{question}</div>
        </div>
      )}

      {/* Main response - raw markdown, no chrome */}
      <div className="verdict-response">
        {isLoading ? (
          <div className="loading-skeleton">
            <div className="skeleton-line wide" />
            <div className="skeleton-line medium" />
            <div className="skeleton-line wide" />
            <div className="skeleton-line short" />
          </div>
        ) : stage3Content ? (
          <div className="markdown-content">
            <ReactMarkdown>{stage3Content}</ReactMarkdown>
          </div>
        ) : (
          <p className="awaiting">Awaiting council verdict...</p>
        )}
      </div>

      {/* Collapsible stages - only show when we have data */}
      {!isLoading && stage3Content && (
        <div className="verdict-stages">
          {/* Stage 1: Individual Responses */}
          {hasStage1 && (
            <CollapsibleStage
              title="Stage 1: Individual Responses"
              count={stage1.length}
              countLabel="models"
              defaultExpanded={false}
              className="stage-1-section"
            >
              <Stage1 stage1={stage1} />
            </CollapsibleStage>
          )}

          {/* Stage 1.5: Cross-Review (Extra Care mode only) */}
          {hasStage1_5 && (
            <CollapsibleStage
              title="Stage 1.5: Cross-Review"
              count={stage1_5.length}
              countLabel="refined"
              defaultExpanded={false}
              className="stage-1-5-section"
            >
              <Stage1_5 stage1_5={stage1_5} />
            </CollapsibleStage>
          )}

          {/* Stage 2: Peer Rankings */}
          {hasStage2 && (
            <CollapsibleStage
              title="Stage 2: Peer Rankings"
              count={stage2.length}
              countLabel="evaluations"
              defaultExpanded={false}
              className="stage-2-section"
            >
              <Stage2
                stage2={stage2}
                labelToModel={labelToModel}
                aggregateRankings={aggregateRankings}
              />
            </CollapsibleStage>
          )}
        </div>
      )}

      {/* Actions (Copy, PDF) */}
      {stage3Content && !isLoading && (
        <div className="dossier-actions">
          <button
            className="action-btn"
            onClick={() => handleCopy(question, stage3Content)}
            title="Copy to clipboard"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copy
          </button>

          <button
            className="action-btn"
            onClick={() => handlePDF(question, stage3Content)}
            title="Download as PDF"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
            PDF
          </button>
        </div>
      )}
    </div>
  );
}

// Copy handler
function handleCopy(question, content) {
  const text = `QUESTION:\n${question}\n\nDECISION:\n${content}`;
  navigator.clipboard.writeText(text).then(() => {
    console.log('Copied to clipboard');
  });
}

// PDF handler
async function handlePDF(question, content) {
  try {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;
    let y = margin;

    // Title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('COUNCIL VERDICT', margin, y);
    y += 10;

    // Question
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text('QUERY:', margin, y);
    y += 6;

    doc.setTextColor(0);
    const questionLines = doc.splitTextToSize(question, maxWidth);
    doc.text(questionLines, margin, y);
    y += questionLines.length * 5 + 10;

    // Divider
    doc.setDrawColor(200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 10;

    // Decision
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('DECISION:', margin, y);
    y += 6;

    doc.setTextColor(0);
    const contentLines = doc.splitTextToSize(content, maxWidth);

    // Handle pagination
    const pageHeight = doc.internal.pageSize.getHeight();
    for (const line of contentLines) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += 5;
    }

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text('Generated by DecidePlease', margin, pageHeight - 10);

    // Save
    const filename = `decision-${Date.now()}.pdf`;
    doc.save(filename);
  } catch (error) {
    console.error('Failed to generate PDF:', error);
  }
}
