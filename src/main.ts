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
      .warning {
        background: #fffbeb; border: 1px solid #fcd34d; border-radius: 6px; padding: 10px 12px;
        font-size: 0.82rem; color: #92400e; margin-top: 8px; line-height: 1.5;
      }
      .warning code { background: #fef3c7; padding: 1px 4px; border-radius: 3px; font-size: 0.8rem; }
      .preset-buttons { display: flex; gap: 6px; margin-bottom: 6px; flex-wrap: wrap; }
      .preset-btn {
        padding: 4px 10px; font-size: 0.78rem; font-weight: 500;
        background: #e5e7eb; color: #374151; border: 1px solid #d1d5db; border-radius: 4px;
        cursor: pointer; transition: background 0.15s;
      }
      .preset-btn:hover { background: #d1d5db; }
      .node-check { display: flex; gap: 8px; align-items: center; margin-top: 4px; }
      .node-result {
        font-size: 0.85rem; font-weight: 600; padding: 4px 10px; border-radius: 4px;
        display: inline-block;
      }
      .node-result.exists { color: #166534; background: #dcfce7; }
      .node-result.absent { color: #991b1b; background: #fee2e2; }
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
            Field Inclusion <span class="hint">(Attributes header, use dot-notation or "*")</span>
          </label>
          <input type="text" id="include-input" value="" placeholder='e.g. A.B, A.C or *' />
        </div>

        <div>
          <label for="exclude-input">
            Field Exclusion <span class="hint">(Attributes-Excluded header, use dot-notation)</span>
          </label>
          <input type="text" id="exclude-input" value="" placeholder="e.g. A.B.X.P" />
        </div>

        <div class="full">
          <label for="explicit-input">
            Explicit Fields <span class="hint">(use dot-notation)</span>
          </label>
          <textarea id="explicit-input" rows="3" spellcheck="false"></textarea>
        </div>
      </div>

      <div class="actions">
        <button id="apply-btn">Apply Filter</button>
      </div>
      <div id="field-warning" class="warning" style="display:none"></div>
    </div>

    <div class="section result-section">
      <label for="json-output">Filtered Output</label>
      <textarea id="json-output" class="json-output" readonly spellcheck="false"></textarea>
    </div>

    <div class="section result-section">
      <label for="node-input">
        Check if this node exists in the filtered response <span class="hint">(dot-notation field name)</span>
      </label>
      <div class="node-check">
        <input type="text" id="node-input" placeholder="e.g. routes.legs.points" />
        <button id="node-check-btn">Check</button>
      </div>
      <div id="node-result"></div>
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
  const nodeInput = document.getElementById("node-input") as HTMLInputElement
  const nodeCheckBtn = document.getElementById("node-check-btn") as HTMLButtonElement
  const nodeResult = document.getElementById("node-result")!

  function applyPreset(preset: Preset["preset"]): void {
    jsonInput.value = JSON.stringify(preset.response, null, 2)
    includeInput.value = preset.include
    excludeInput.value = preset.exclude
    explicitInput.value = preset.explicit
  }

  const fieldWarning = document.getElementById("field-warning")!

  /**
   * Collect all known dot-notation field paths from a JSON value.
   * Arrays are transparent — their items are traversed with the same path prefix.
   */
  function collectKnownPaths(value: unknown, prefix: string[] = []): Set<string> {
    const paths = new Set<string>()
    if (value === null || typeof value !== "object") return paths

    if (Array.isArray(value)) {
      for (const item of value) {
        for (const p of collectKnownPaths(item, prefix)) paths.add(p)
      }
      return paths
    }

    for (const key of Object.keys(value as Record<string, unknown>)) {
      const childPath = [...prefix, key]
      paths.add(childPath.join("."))
      for (const p of collectKnownPaths((value as Record<string, unknown>)[key], childPath)) {
        paths.add(p)
      }
    }
    return paths
  }

  /**
   * Check whether a dot-notation field path (or any prefix/descendant of it)
   * matches a known path in the JSON. A field is considered "known" if:
   * - It exactly matches a known path.
  */
  function isFieldKnown(field: string, knownPaths: Set<string>): boolean {
    return knownPaths.has(field);

  }

  function applyFilter(): void {
    jsonError.textContent = ""
    fieldWarning.style.display = "none"
    fieldWarning.innerHTML = ""

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

    // Validate fields against the input JSON.
    const knownPaths = collectKnownPaths(parsed)

    const includeRaw = includeInput.value.trim()
    const includeFields = includeRaw === "*" || includeRaw.length === 0
      ? []
      : includeRaw.split(",").map((e) => e.trim()).filter((e) => e.length > 0)
    const excludeFields = excludeInput.value.trim().length === 0
      ? []
      : excludeInput.value.split(",").map((e) => e.trim()).filter((e) => e.length > 0)

    const unknownInclude = includeFields.filter((f) => !isFieldKnown(f, knownPaths))
    const unknownExclude = excludeFields.filter((f) => !isFieldKnown(f, knownPaths))
    const unknownExplicit = explicitFields.filter((f) => !isFieldKnown(f, knownPaths))

    const warnings: string[] = []
    if (unknownInclude.length > 0) {
      warnings.push(`<strong>Inclusion:</strong> ${unknownInclude.map((f) => `<code>${f}</code>`).join(", ")}`)
    }
    if (unknownExclude.length > 0) {
      warnings.push(`<strong>Exclusion:</strong> ${unknownExclude.map((f) => `<code>${f}</code>`).join(", ")}`)
    }
    if (unknownExplicit.length > 0) {
      warnings.push(`<strong>Explicit:</strong> ${unknownExplicit.map((f) => `<code>${f}</code>`).join(", ")}`)
    }

    if (warnings.length > 0) {
      fieldWarning.innerHTML = `⚠️ Unknown fields (not found in JSON):<br>${warnings.join("<br>")}`
      fieldWarning.style.display = "block"
    }

    const filter = new FieldFilter({
      include: includeInput.value,
      exclude: excludeInput.value,
      explicitFields,
    })

    const result = filter.apply(parsed as Parameters<typeof filter.apply>[0])
    jsonOutput.value =
        result === undefined ? "(entire object was excluded)" : JSON.stringify(result, null, 2)
  }

  nodeCheckBtn.addEventListener("click", () => {
    nodeResult.textContent = ""
    nodeResult.className = ""

    const fieldName = nodeInput.value.trim()
    if (fieldName.length === 0) {
      nodeResult.textContent = ""
      return
    }

    const outputText = jsonOutput.value.trim()
    if (outputText.length === 0 || outputText === "(entire object was excluded)") {
      nodeResult.textContent = "No filtered response available"
      nodeResult.className = "node-result absent"
      return
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(outputText)
    } catch {
      nodeResult.textContent = "Cannot check — invalid filtered response"
      nodeResult.className = "node-result absent"
      return
    }

    const knownPaths = collectKnownPaths(parsed)
    if (isFieldKnown(fieldName, knownPaths)) {
      nodeResult.textContent = "Exists in response"
      nodeResult.className = "node-result exists"
    } else {
      nodeResult.textContent = "Absent in response"
      nodeResult.className = "node-result absent"
    }
  })

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
