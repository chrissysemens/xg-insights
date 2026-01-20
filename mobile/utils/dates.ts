const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

function ordinalSuffix(n: number): string {
	const j = n % 10;
	const k = n % 100;
	if (j === 1 && k !== 11) return 'st';
	if (j === 2 && k !== 12) return 'nd';
	if (j === 3 && k !== 13) return 'rd';
	return 'th';
}

export const friendlyDate = (timestamp: number): string => {
	const ms = timestamp < 1_000_000_000_000 ? timestamp * 1000 : timestamp;
	const d = new Date(ms);
	const dayName = DAYS[d.getDay()];
	const day = d.getDate();
	const monthName = MONTHS[d.getMonth()];
	return `${dayName} ${day}${ordinalSuffix(day)} ${monthName}`;
}

