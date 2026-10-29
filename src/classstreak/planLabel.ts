// Last week is one line plus a dot on each day they worked out:
// "Worked out 3 days", or "Worked out 3 of 4 planned days" when there was a plan.
export function lastWeekLabel(plan:{days:{done:boolean}[];planned_days:number;completed_days:number}){
 const worked=plan.days.filter(d=>d.done).length;
 if(!plan.planned_days)return `Worked out ${worked} ${worked===1?'day':'days'}`;
 return `Worked out ${plan.completed_days} of ${plan.planned_days} planned ${plan.planned_days===1?'day':'days'}`;
}
