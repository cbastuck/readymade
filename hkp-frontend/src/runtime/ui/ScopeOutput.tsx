import Select from "hkp-frontend/src/ui-components/Select";

/**
 * Whether what a scope's pipeline produced leaves the service.
 *
 * The other thing a scope declares, beside where its cells are, and the one
 * with consequences a reader cannot see from the pipeline: a scope that passes
 * nothing on is entered by being addressed, so the services drawn after it
 * never run from this one — which looks exactly like a board that is wired
 * wrong until something says so.
 *
 * Said in what it does rather than in the board's own `stopPropagation`,
 * because the board spells it as a boolean and a panel would then be offering
 * true and false as if they were the choice. `continues` and `stops` are the
 * choice.
 *
 * It closes both ways out, which is why the word is output and not *result*:
 * the answer this service gives, and what the pipeline pushed without being
 * asked — a Timer tick, a reply that arrived late — stop together.
 */
type Props = {
  /** Whether nothing leaves, which is the board's `stopPropagation`. */
  stops: boolean;
  /** Absent where a panel can read a scope but not configure it. */
  onChange?: (stops: boolean) => void;
};

const CONTINUES = "continues";
const STOPS = "stops";

const WHAT_IT_MEANS =
  "Continues: what this pipeline produced is passed to the services after it. " +
  "Stops: nothing leaves — not the answer, and not what the pipeline pushed on " +
  "its own, so the services after it run only when something else enters them.";

export default function ScopeOutput({ stops, onChange }: Props) {
  const value = stops ? STOPS : CONTINUES;

  return (
    <div
      className="w-full flex items-center gap-2 mt-1"
      style={{ fontSize: 12 }}
    >
      <span className="text-gray-400" title={WHAT_IT_MEANS}>
        Output
      </span>

      <div
        className="ml-auto flex items-center gap-2 text-gray-400"
        title={WHAT_IT_MEANS}
      >
        {onChange ? (
          <Select
            title="output"
            compact
            value={value}
            options={[CONTINUES, STOPS]}
            onChange={(next: string) => onChange(next === STOPS)}
          />
        ) : (
          <span>{value}</span>
        )}
      </div>
    </div>
  );
}
