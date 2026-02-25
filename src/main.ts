import { FieldFilter } from "./FieldFilter"

interface Preset {
  preset: {
    name: string
    include: string
    exclude: string
    explicit: string
    response: unknown
  }
}

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
      .preset-buttons { display: flex; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
      .preset-btn {
        padding: 4px 10px; font-size: 0.78rem; font-weight: 500;
        background: #e5e7eb; color: #374151; border: 1px solid #d1d5db; border-radius: 4px;
        cursor: pointer; transition: background 0.15s;
      }
      .preset-btn:hover { background: #d1d5db; }
      .section { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
      .result-section { margin-top: 16px; }
      .info-box {
        background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 12px;
        font-size: 0.82rem; color: #1e40af; margin-bottom: 16px; line-height: 1.5;
      }
      .info-box code { background: #dbeafe; padding: 1px 4px; border-radius: 3px; font-size: 0.8rem; }
      .toolbox {
        margin-top: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
        padding: 10px 14px; font-size: 0.82rem; color: #475569;
      }
      .toolbox-title { font-weight: 600; margin-bottom: 4px; font-size: 0.82rem; }
      .toolbox a { color: #3b82f6; text-decoration: none; }
      .toolbox a:hover { text-decoration: underline; }
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
          <div id="preset-buttons" class="preset-buttons"></div>
          <textarea id="json-input" class="json-input" spellcheck="false"></textarea>
          <div id="json-error" class="error"></div>
        </div>

        <div>
          <label for="include-input">
            Field Inclusion <span class="hint">(Attributes header)</span>
          </label>
          <input type="text" id="include-input" value="" placeholder='e.g. A.B, A.C or *' />
        </div>

        <div>
          <label for="exclude-input">
            Field Exclusion <span class="hint">(Attributes-Excluded header)</span>
          </label>
          <input type="text" id="exclude-input" value="" placeholder="e.g. A.B.X.P" />
        </div>

        <div class="full">
          <label for="explicit-input">
            Explicit Fields <span class="hint">(comma or newline separated, dot-notation)</span>
          </label>
          <textarea id="explicit-input" rows="3" spellcheck="false"></textarea>
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

    <div class="toolbox">
      <div class="toolbox-title">🧰 Toolbox</div>
      <a href="https://dot-notation-7hyuu.ondigitalocean.app/" target="_blank" rel="noopener noreferrer">Convert between JSON and dot-notation</a>
    </div>
  `

  const jsonInput = document.getElementById("json-input") as HTMLTextAreaElement
  const includeInput = document.getElementById("include-input") as HTMLInputElement
  const excludeInput = document.getElementById("exclude-input") as HTMLInputElement
  const explicitInput = document.getElementById("explicit-input") as HTMLTextAreaElement
  const jsonOutput = document.getElementById("json-output") as HTMLTextAreaElement
  const jsonError = document.getElementById("json-error")!
  const applyBtn = document.getElementById("apply-btn") as HTMLButtonElement
  const presetButtonsContainer = document.getElementById("preset-buttons")!

  function applyPreset(preset: Preset["preset"]): void {
    jsonInput.value = JSON.stringify(preset.response, null, 2)
    includeInput.value = preset.include
    excludeInput.value = preset.exclude
    explicitInput.value = preset.explicit
  }

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
      .split(/[,\n]/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)

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

  // Load presets from presets.json and create buttons dynamically.
  fetch("/presets.json")
    .then((response) => response.json())
    .then((presets: Preset[]) => {
      presets.forEach((entry) => {
        const btn = document.createElement("button")
        btn.className = "preset-btn"
        btn.textContent = entry.preset.name
        btn.addEventListener("click", () => {
          applyPreset(entry.preset)
        })
        presetButtonsContainer.appendChild(btn)
      })

      // Apply the first preset on load to show initial result.
      const first = presets[0]
      if (first) {
        applyPreset(first.preset)
        applyFilter()
      }
    })
    .catch((e) => {
      jsonError.textContent = `Failed to load presets: ${(e as Error).message}`
    })
}

createApp()
