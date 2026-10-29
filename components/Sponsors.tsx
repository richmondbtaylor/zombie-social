// Footer on every page: who this hackathon is built with. Quill is the Prompt Anything mascot.
export default function Sponsors() {
  return (
    <footer className="sponsors">
      <img src="/quill.png" alt="Quill, the Prompt Anything mascot, in a Halloween costume" className="sponsors-quill" />
      <div className="sponsors-text">
        <p className="sponsors-eyebrow">Built at AI Builders Miami with</p>
        <p className="sponsors-logos">
          <a href="https://www.promptanything.io" className="sponsors-pa">
            <img src="/pa-icon.png" alt="" />Prompt Anything
          </a>
          <span className="sponsors-x">×</span>
          <a href="https://openmel.dev" className="sponsors-mel" aria-label="Mel">mel</a>
        </p>
        <p className="sponsors-note">Prompt Anything writes the prompts. Mel builds the code. You bring this app back to life.</p>
      </div>
    </footer>
  );
}
