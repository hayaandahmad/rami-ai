interface ChoiceButtonGroupProps {
  choices: string[];
  value: string;
  onChange: (value: string) => void;
  name: string;
  disabled?: boolean;
  describedById?: string;
  labelledById?: string;
}

export function ChoiceButtonGroup({
  choices,
  value,
  onChange,
  name,
  disabled = false,
  describedById,
  labelledById,
}: ChoiceButtonGroupProps) {
  return (
    <fieldset
      className="space-y-2"
      aria-describedby={describedById}
      aria-labelledby={labelledById}
    >
      <legend className="sr-only">Select one option</legend>
      {choices.map((choice) => {
        const id = `${name}-${choice.toLowerCase().replace(/\s+/g, "-")}`;
        const isSelected = value === choice;

        return (
          <label
            key={choice}
            htmlFor={id}
            className={`flex cursor-pointer items-center gap-3 rounded-control border px-4 py-3 text-small transition-hover ${
              isSelected
                ? "border-[var(--color-primary-600)] bg-[var(--color-primary-50)] font-semibold text-[var(--color-primary-800)]"
                : "border-border bg-surface text-text-primary hover:border-border-strong hover:bg-surface-subtle"
            } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
          >
            <input
              id={id}
              type="radio"
              name={name}
              value={choice}
              checked={isSelected}
              onChange={() => onChange(choice)}
              disabled={disabled}
              className="h-4 w-4 shrink-0 accent-[var(--color-primary-700)] focus:ring-2 focus:ring-[var(--color-primary-200)] focus:outline-none"
            />
            {choice}
          </label>
        );
      })}
    </fieldset>
  );
}
