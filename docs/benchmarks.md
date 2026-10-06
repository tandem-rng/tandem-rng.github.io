# Benchmark data

`data/benchmarks.json` feeds the "Every port" table on the landing page. `assets/bench.js` renders it, and the URL hash picks the port, for example `#torch`.

## Rules

- Take every figure from a port's committed docs: `docs/speed.md`, `docs/notes.md`, the README, or TandemRNG.jl's `docs/src/performance.md`.
- Never copy a figure from a benchmark log, a chat, or a host under load. Never record host load.
- Give a baseline only when the same table measures it on the same hardware and size.
- Use only third-party generators as baselines, never our own code. PureRNGs.jl and every
  Tandem port are ours. For Philox, use cuRAND on CUDA, Random123 in C and Julia, and NumPy's
  `Philox` in Python.
- Give every figure in GiB/s of output, scalar draws included. A port moves a row to GiB/s by
  remeasuring it, so never take a figure converted from a time per value.
- Put the fastest third-party generator the source measures for the row first, a noncrypto one
  when there is a choice. Give every A100 row cuRAND Philox4x32-10. Where cuRAND has no exact
  counterpart, the source names the nearest call, and the row's `setup` says so.
- Where another baseline has no matching draw and the source compares with its raw words or
  uniforms, end the baseline `name` with ` *` and quote the source's explanation in the port `note`.
- Keep a row when Tandem loses. The page shows the ratio either way.
- Label the Apple bench machine `Apple M4 Pro`, its sysctl brand string. Some port pages call it
  "M4". Copy their figures as they are, but keep the site's label.

## Row fields

| field | meaning |
|---|---|
| `port` | an `id` from `ports` |
| `hardware` | the machine, for example `NVIDIA A100 40 GB` or `Apple M4 Pro`. Rows group by this string |
| `draw` | the call as the source names it |
| `kind` | `uniform`, `bits`, `bounded`, `normal` or `exponential` |
| `setup` | threads, element count, toolchain, as the source gives them |
| `gib_s`, `gib_s_max` | GiB/s written. Use `gib_s_max` for a range |
| `baseline` | optional `{ name, gib_s, gib_s_max }`, the fastest third-party generator for the row |
| `baseline_alt` | optional second baseline in the same shape, for example Philox next to PCG64. The page shows its ratio under the first |
| `f64_normal` | `true` on Float64 normal rows |
| `ziggurat` | `true` once a Float64 normal row is measured with the ziggurat. The page marks the other Float64 normal rows as pending |
| `source` | `{ path, commit }`. The commit is the port's `origin/main` short hash when you read the file |

## Add a port

1. Add `{ "id", "name", "repo" }` to `ports`. `repo` is the name under github.com/tandem-rng.
2. Add its rows. The picker shows a port only when it has rows.
3. For a port under review, add `"review"` with one sentence. The page shows it above the sources.
   Remove it when the review closes.
4. For a method that applies to every row of a port, add `"note"` with the source page's own
   wording, at most two sentences. The page shows it before the sources line.

No page change is needed. Add only public repos.

## Refresh rows

1. Run `git fetch` in the port checkout and read the speed doc at `origin/main`.
2. Update `gib_s`, both baselines and `source.commit` together, from one table. Update `source.path` when the doc moved.
3. Run the check below. Then render the page at 1280 px and 400 px in both themes.

Every port draws Float64 normals from the ziggurat of SPEC.md Appendix A, and every row with
`f64_normal: true` carries `ziggurat: true`. Give a new Float64 normal row both fields and
"ziggurat" in its `setup`. Point `source` at the commit whose docs carry the figure, which can
be a docs commit after the code commit. Keep `f64_normal`, so a later refresh can find the rows.

## Check

Run this in the directory above the port checkouts. It prints each number that is missing from its source at the pinned commit.

```sh
jq -r '(.ports|map({(.id):.repo})|add) as $R | .rows[] | . as $x
  | [$x.gib_s, $x.gib_s_max, $x.baseline.gib_s, $x.baseline.gib_s_max,
     $x.baseline_alt.gib_s, $x.baseline_alt.gib_s_max][]
  | select(. != null)
  | [$R[$x.port], $x.source.commit, $x.source.path, tostring] | @tsv' \
  tandem-rng.github.io/data/benchmarks.json |
while IFS=$'\t' read -r repo commit file value; do
  git -C "$repo" show "$commit:$file" | rg -q "(^|[^0-9.])${value//./\\.}0?([^0-9]|$)" ||
    echo "missing: $repo@$commit $file $value"
done
```
