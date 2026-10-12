interface DiceCountBadgeProps {
  count: number;
}

const DiceCountBadge = ({ count }: DiceCountBadgeProps) => (
  <span className={`xdt-dice-count${count > 0 ? ' is-visible' : ''}`} aria-hidden="true">
    {count}
  </span>
);

export default DiceCountBadge;
