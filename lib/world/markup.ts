export const worldMarkup = `
    <div class="layout">
      <section aria-label="Interactive Moonclay scene">

        <div class="scene-top">
          <div class="scene-nav" role="group" aria-label="Scene navigation">
            <button id="camp" type="button">← The camp</button>
            <label class="sr-only" for="room-select">Explore a room</label>
            <select id="room-select">
              <option value="camp">Choose a room…</option>
              <option value="bathhouse">Bathhouse</option>
              <option value="dream-garden" selected>Dream Garden</option>
              <option value="quiet-house">Quiet House</option>
              <option value="source">The Source</option>
              <option value="open-studio">Open Studio</option>
              <option value="hearth">Hearth</option>
              <option value="temple">Temple</option>
            </select>
          </div>
        </div>

        <div class="stage" id="stage">
          <canvas
            id="world"
            role="img"
            aria-label="Animated Moonclay scene with individually selectable illustrative visitors"
            aria-describedby="scene-caption"
            >Use the visitor list alongside the scene to inspect the same
            illustrative visitors.</canvas
          >
          <div class="stage-label">
            <strong id="scene-title" tabindex="-1" role="heading" aria-level="2"
              >Dream Garden</strong>
          </div>
          <div id="room-links"></div>
          <div class="stage-footer">
            <span id="canvas-count">Loading the ceramic stage…</span>
          </div>
      <details class="crowd-overlay"><summary>Visitors <span class="drawer-close" aria-hidden="true">×</span></summary><aside aria-label="Crowd controls and activity">
        <div id="visitor-display-controls"></div>
        <section class="control-block">
          <div class="control-title">
            <label for="population">Visitors across the camp</label
            ><output id="population-value" for="population">1000</output>
          </div>
          <input
            id="population"
            type="range"
            min="0"
            max="1000"
            step="1"
            value="1000"
          />
          <div class="range-labels">
            <span>0 · still beautiful</span><span>1,000 · busy retreat</span>
          </div>
          <div class="presets" aria-label="Crowd presets">
            <button data-count="0">Empty</button
            ><button data-count="12">Quiet morning</button
            ><button data-count="60">A gathering</button
            ><button data-count="1000" aria-pressed="true">Festival night</button>
          </div>
          <div class="counts">
            <div>
              <strong id="shown">0</strong><span>creatures in view</span>
            </div>
            <div>
              <strong id="eligible">0</strong
              ><span id="eligible-label">at the Dream Garden</span>
            </div>
          </div>
          <p id="scope-note"></p>
        </section>
        <section class="control-block">
          <div class="roster-heading">
            <h2>Visitors</h2>
            <span>All in this area</span>
          </div>
          <label class="sr-only" for="search">Find an example visitor</label
          ><input
            type="search"
            id="search"
            placeholder="Find visitor or family…"
            autocomplete="off"
          />
          <div id="roster"></div>
          <div class="visitor-navigate">
            <button id="previous-page" aria-label="Previous visitors">←</button
            ><span id="page-label"></span
            ><button id="next-page" aria-label="Next visitors">→</button>
          </div>
        </section>
        <section class="inspection" id="inspection" aria-live="polite">
          <h3>Meet a little wanderer</h3>
          <p>
            Select a creature to meet it.
          </p>
        </section>
      </aside></details>
      <dialog class="visitors-modal" aria-label="Visitors"></dialog>
        </div>
        <div class="below-scene">
          <nav
            id="court-nav"
            class="court-nav"
            aria-label="Room section navigation"
            hidden
          >
            <button id="previous-court" aria-label="Previous courtyard">
              ←</button
            ><span id="court-label"></span
            ><button id="next-court" aria-label="Next courtyard">→</button>
          </nav>
        </div>
        <div class="scene-toolbar">
        <section class="sound-controls" aria-label="Scene sound controls">
          <button id="sound-toggle" type="button" aria-pressed="true">
            Sound on
          </button>
          <label class="sound-volume" for="sound-volume"
            >Volume
            <input
              id="sound-volume"
              type="range"
              min="0"
              max="100"
              value="40"
            /><output id="sound-volume-value" for="sound-volume"
              >40%</output
            ></label
          >
        </section>
          <p id="scene-caption">
            Drag a creature to move it.
          </p>
        </div>
        <p id="sound-status" class="sound-help" aria-live="off">
          Sound starts when you touch the scene.
        </p>
        <p id="sound-focus" class="sound-focus"></p>

      </section>

    </div>
`
