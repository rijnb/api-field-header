import { FieldFilter } from "./FieldFilter"

const SAMPLE_JSON = JSON.stringify(
  {
    A: {
      B: {
        X: { P: "p-value", Q: "q-value" },
        Y: "y-value",
      },
      C: {
        Z: "z-value",
      },
    },
  },
  null,
  2,
)

const SAMPLE_INCLUDE = "A"
const SAMPLE_EXCLUDE = ""
const SAMPLE_EXPLICIT = "A.B.X\nA.B.X.Q"

function createApp(): void {
  const app = document.getElementById("app")!

  app.innerHTML = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: system-ui, -apple-system, sans-serif; background: #f5f5f5; color: #1a1a1a; }
      #app { max-width: 960px; margin: 0 auto; padding: 24px 16px; }
      h1 { font-size: 1.5rem; margin-bottom: 4px; }
      .subtitle { color: #666; font-size: 0.9rem; margin-bottom: 24px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      .full { grid-column: 1 / -1; }
      label { display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 4px; }
      .hint { font-weight: 400; color: #666; }
      textarea, input[type="text"] {
        width: 100%; padding: 8px 10px; border: 1px solid #ccc; border-radius: 6px;
        font-family: "SF Mono", "Fira Code", "Cascadia Code", monospace; font-size: 0.85rem;
        background: #fff; resize: vertical;
      }
      textarea:focus, input[type="text"]:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
      .json-input { min-height: 200px; }
      .json-output { min-height: 200px; background: #f9fafb; }
      button {
        padding: 8px 20px; border: none; border-radius: 6px; font-size: 0.9rem; font-weight: 600;
        cursor: pointer; background: #3b82f6; color: #fff; transition: background 0.15s;
      }
      button:hover { background: #2563eb; }
      .actions { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
      .error { color: #dc2626; font-size: 0.85rem; margin-top: 4px; min-height: 1.2em; }
      .section { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
      .result-section { margin-top: 16px; }
      .info-box {
        background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px;
        font-size: 0.82rem; color: #1e40af; margin-bottom: 16px; line-height: 1.5;
      }
      .info-box code { background: #dbeafe; padding: 1px 4px; border-radius: 3px; font-size: 0.8rem; }
    </style>

    <h1>API Field Header Filter</h1>
    <p class="subtitle">Test field inclusion &amp; exclusion filters for API responses</p>

    <div class="info-box">
      <strong>Rules:</strong> Inclusion uses comma-separated dot-notation (e.g. <code>A.B, A.C</code>)
      or <code>*</code> for all non-explicit fields.
      Exclusion overrides inclusion. Explicit fields require explicit mention&nbsp;&mdash; a parent inclusion does not implicitly include them.
    </div>

    <div class="section">
      <div class="grid">
        <div class="full">
          <label for="json-input">JSON Input</label>
          <textarea id="json-input" class="json-input" spellcheck="false">${escapeHtml(SAMPLE_JSON)}</textarea>
          <div id="json-error" class="error"></div>
        </div>

        <div>
          <label for="include-input">
            Field Inclusion <span class="hint">(Attributes header)</span>
          </label>
          <input type="text" id="include-input" value="${escapeHtml(SAMPLE_INCLUDE)}" placeholder='e.g. A.B, A.C or *' />
        </div>

        <div>
          <label for="exclude-input">
            Field Exclusion <span class="hint">(Attributes-Excluded header)</span>
          </label>
          <input type="text" id="exclude-input" value="${escapeHtml(SAMPLE_EXCLUDE)}" placeholder="e.g. A.B.X.P" />
        </div>

        <div class="full">
          <label for="explicit-input">
            Explicit Fields <span class="hint">(one per line, dot-notation)</span>
          </label>
          <textarea id="explicit-input" rows="3" spellcheck="false">${escapeHtml(SAMPLE_EXPLICIT)}</textarea>
        </div>
      </div>

      <div class="actions">
        <button id="apply-btn">Apply Filter</button>
      </div>
    </div>

    <div class="section result-section">
      <label for="json-output">Filtered Output</label>
      <textarea id="json-output" class="json-output" readonly spellcheck="false"></textarea>
    </div>
  `

  const jsonInput = document.getElementById("json-input") as HTMLTextAreaElement
  const includeInput = document.getElementById("include-input") as HTMLInputElement
  const excludeInput = document.getElementById("exclude-input") as HTMLInputElement
  const explicitInput = document.getElementById("explicit-input") as HTMLTextAreaElement
  const jsonOutput = document.getElementById("json-output") as HTMLTextAreaElement
  const jsonError = document.getElementById("json-error")!
  const applyBtn = document.getElementById("apply-btn") as HTMLButtonElement

  function applyFilter(): void {
    jsonError.textContent = ""

    let parsed: unknown
    try {
      parsed = JSON.parse(jsonInput.value)
    } catch (e) {
      jsonError.textContent = `Invalid JSON: ${(e as Error).message}`
      jsonOutput.value = ""
      return
    }

    const explicitFields = explicitInput.value
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)

    const filter = new FieldFilter({
      include: includeInput.value,
      exclude: excludeInput.value,
      explicitFields,
    })

    const result = filter.apply(parsed as Parameters<typeof filter.apply>[0])
    jsonOutput.value =
      result === undefined ? "(entire object was excluded)" : JSON.stringify(result, null, 2)
  }

  applyBtn.addEventListener("click", applyFilter)

  // Apply on load to show initial result.
  applyFilter()
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

createApp()
