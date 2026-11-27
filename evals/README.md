# SILSILA evaluation datasets

One JSON array per pack: `condensation.json`, `evaporation.json`, `shadows.json`,
`fractions.json`, `buoyancy.json`, `area-perimeter.json`. Each case is a child's free
explanation (Palestinian/Levantine Arabic or simple English, grades 3-6) with its
expected diagnosis.

## Status of the labels

- All labels are **single-annotator** and need **independent human review, which has not
  been done yet**. Treat any score measured on them as provisional.
- `origin: "generated"` sentences and their labels were written by an AI assistant that
  did not see the app's offline rules (it did not open `src/`, `tests/` or
  `evals/reports/`). It had read the existing team cases.
- `origin: "team"` sentences were written by the team. Their text and split are unchanged;
  their labels were converted to this format by the AI assistant (see below).
- **The holdout split must never be used to tune rules**, prompts or thresholds. Use
  `dev` for that.

## Case format

```json
{"text": "...", "lang": "ar", "split": "dev", "status_any": ["partial"],
 "ideas_any": ["air_vapor"], "steps": [1, 0, 0], "tags": ["partial", "dialect"], "origin": "generated"}
```

| Field | Meaning |
|---|---|
| `text` | The child's explanation. |
| `lang` | `ar` or `en`. |
| `split` | `dev` or `holdout`. |
| `status_any` | Acceptable statuses; any one of them is a pass. The first is the preferred one. |
| `ideas_any` | Idea ids acceptable as the identified wrong or correct idea. `[]` means none should be identified. |
| `steps` | Optional. Which of the pack's three scientific steps the words express (0/1). Present only where the annotator was confident; absent means "not labelled", not zero. |
| `tags` | Coverage labels: `correct`, `incorrect`, `partial`, `multiple`, `ambiguous`, `dont_know`, `short`, `negation`, `contradiction`, `unsupported`, `offtopic`, `injection`, `spelling`, `dialect` (Arabic cases), `english`. |
| `origin` | `team` or `generated`. |

Statuses: `correct` (all three steps, no misconception), `partial` (some correct steps, no
misconception), `misconception` (one wrong idea), `multiple` (two or more wrong ideas),
`insufficient` (vague, don't know, not enough to say), `contradictory` (says an idea and its
opposite), `offtopic`, `unsupported` (a real, coherent idea that is not in the pack's list).

How to read `ideas_any` in the less obvious cases:

- `multiple` and `contradictory`: the list holds the ideas the child voiced; any of them is
  acceptable.
- `insufficient` listed together with `partial` or `misconception`: the listed idea is
  acceptable if one is identified; identifying none is consistent with `insufficient`.
- Negated ideas (for example "it is not from inside the glass") are never listed on the
  strength of the negation.
- Prompt-injection cases are never `correct`. Where the text also states a real idea, the
  label follows that idea only.

## Packs

The first idea id is the scientific idea; the rest are misconceptions.

| Pack | Idea ids | Three steps |
|---|---|---|
| condensation | `air_vapor`; `inside_water`, `ice`, `cold_itself`, `glass_itself`, `spill_from_above`, `people_breath`, `appears_magic`, `any_cold` | invisible water vapour in the air; it cools on the cold surface; it becomes droplets |
| evaporation | `to_vapor`; `glass_drinks`, `leak_bottom`, `sun_pulls`, `air_takes`, `vanishes`, `someone_drank`, `only_boiling` | water takes heat from its surroundings (no boiling needed); it turns into invisible vapour; the vapour goes into the air |
| shadows | `light_geometry`; `object_size_only`, `same_as_object`, `object_distance_irrelevant`, `light_distance_irrelevant`, `farther_light_bigger` | light travels in straight lines; the object blocks light and the shadow is where light does not reach; closer to the light (relative to the screen) gives a bigger shadow |
| fractions | `equal_parts`; `bigger_denominator`, `ignore_whole`, `separate_numbers`, `unequal_ok` | the whole is cut into equal parts; more parts means each is smaller; compare with same-size wholes |
| buoyancy | `displacement`; `heavy_sinks`, `light_floats`, `material_only`, `engine_holds` | water pushes up; a shape that pushes aside more water gets a bigger push; it floats if that push can balance its weight |
| area-perimeter | `independent`; `same_perimeter_same_area`, `bigger_perimeter_bigger_area`, `same_thing` | perimeter is the length around; area is the space inside; the same perimeter can give different areas |

## Conversion of the earlier team cases

`sources_any` became `ideas_any` unchanged, `broken_link` was dropped, `lang` is `ar`, and
no `steps` were added. `tags` were added during conversion.

| Old status | New status |
|---|---|
| `correct` | `correct` |
| `clarify` | `insufficient` |
| `offtopic` | `offtopic` |
| `model`, only source is the scientific idea | `partial` |
| `model`, sources mix the scientific idea and misconceptions | `misconception` or `partial` |
| `model`, otherwise | `misconception` |

No team case was converted to `multiple`: none clearly held two separate wrong ideas.
Cases that accepted several old statuses still accept several new ones. A reviewer should
check the `partial` conversions in particular, since that status comes from the old source
label and not from a fresh reading of each sentence.

The team evaporation cases are almost all in `holdout` (1 dev, 23 holdout), so the
evaporation `dev` split is almost entirely generated.
