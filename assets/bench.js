// Renders data/benchmarks.json as one table per port. The URL hash selects the port.
(async () => {
  const picker = document.getElementById("bench-picker");
  const table = document.getElementById("bench-table");
  const notes = document.getElementById("bench-notes");
  const anchor = document.getElementById("bench");

  let data;
  try {
    const res = await fetch("data/benchmarks.json");
    data = await res.json();
  } catch {
    notes.textContent = "The figures could not be loaded. They are in data/benchmarks.json.";
    return;
  }

  const ports = new Map(data.ports.map((p) => [p.id, p]));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  // Float64 normal rows still measured with Box-Muller, before the ziggurat landed in that port.
  const pending = (r) => r.f64_normal && !r.ziggurat;
  // JSON drops a trailing zero, and the sources print whole numbers below 10 as 7.0.
  const num = (x) => (Number.isInteger(x) && x < 10 ? x.toFixed(1) : `${x}`);
  const fmt = (lo, hi) => (hi == null || hi === lo ? num(lo) : `${num(lo)}–${num(hi)}`);

  picker.innerHTML = data.ports
    .filter((p) => data.rows.some((r) => r.port === p.id))
    .map((p) => `<a href="#${p.id}" data-port="${p.id}">${esc(p.name)}</a>`)
    .join("");

  function render(id) {
    const port = ports.get(id);
    for (const a of picker.querySelectorAll("a")) a.setAttribute("aria-current", String(a.dataset.port === id));

    const rows = data.rows.filter((r) => r.port === id);
    const unitOf = (r) => r.unit ?? data.unit;
    const units = new Set(rows.map(unitOf));
    const oneUnit = units.size === 1 ? [...units][0] : null;
    const groups = new Map();
    for (const r of rows) {
      if (!groups.has(r.hardware)) groups.set(r.hardware, []);
      groups.get(r.hardware).push(r);
    }

    let html = `<thead><tr><th>draw</th><th>Tandem${oneUnit ? `, ${esc(oneUnit)}` : ""}</th><th>baseline</th></tr></thead><tbody>`;
    for (const [hw, list] of groups) {
      html += `<tr class="group"><th colspan="3">${esc(hw)}</th></tr>`;
      for (const r of list) {
        const flag = pending(r) ? ` <span class="flag" title="Float64 normal, refresh pending">*</span>` : "";
        // Rows in a time unit, such as ns per value, are faster when smaller.
        const lowerBetter = unitOf(r).startsWith("ns");
        const v = r.gib_s ?? r.value;
        const suffix = oneUnit ? "" : ` <span class="c">${esc(unitOf(r))}</span>`;
        const vs = (bl) => {
          const b = bl.gib_s ?? bl.value;
          const ratio = lowerBetter ? b / v : v / b;
          const cls = ratio >= 1 ? "win" : "loss";
          return `<span class="ratio ${cls}">${ratio.toFixed(ratio >= 10 ? 0 : 2)}×</span> <span class="base">${esc(bl.name)}, ${fmt(b, bl.gib_s_max)}</span>`;
        };
        let base = `<span class="c" title="no baseline in the source">–</span>`;
        if (r.baseline) base = vs(r.baseline) + (r.baseline_alt ? `<span class="alt">${vs(r.baseline_alt)}</span>` : "");
        html += `<tr><td class="draw"><code>${esc(r.draw)}</code>${flag}<span class="setup">${esc(r.setup)}</span></td>`
          + `<td class="num"><strong>${fmt(v, r.gib_s_max)}</strong>${suffix}</td><td>${base}</td></tr>`;
      }
    }
    table.innerHTML = html + "</tbody>";

    const sources = [...new Set(rows.map((r) => `${r.source.path}@${r.source.commit}`))].map((s) => {
      const [path, commit] = s.split("@");
      return `<a href="https://github.com/tandem-rng/${esc(port.repo)}/blob/${esc(commit)}/${esc(path)}">${esc(port.repo)}/${esc(path)} at ${esc(commit)}</a>`;
    });
    const flagged = rows.some(pending)
      ? ` <span class="flag">*</span> Float64 normals move to a ziggurat, so these rows will change.`
      : "";
    const review = port.review ? `<strong>${esc(port.review)}</strong> ` : "";
    notes.innerHTML = `${review}Source: ${sources.join(", ")}. The ratio is how many times faster Tandem runs than the baseline on the same hardware.${flagged}`;
  }

  function fromHash(scroll) {
    const id = location.hash.slice(1);
    render(ports.has(id) ? id : data.default);
    if (scroll && ports.has(id)) anchor.scrollIntoView();
  }

  window.addEventListener("hashchange", () => fromHash(true));
  fromHash(true);
})();
