-- One counted workout per activity per day means an exact weekly goal is 0–7.
-- Broaden validation only; retain all existing preferences and historical weeks.
alter table classstreak.user_activities drop constraint user_activities_goal_check;
alter table classstreak.user_activities add constraint user_activities_goal_check check(goal between 0 and 7);
