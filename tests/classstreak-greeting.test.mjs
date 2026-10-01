import {test} from 'node:test';
import assert from 'node:assert/strict';
import {homeGreeting} from '../src/classstreak/greeting.ts';
test('Greetings follow the local hour, including midnight and a different timezone',()=>{
 const zone='America/Los_Angeles';
 for(const [utc,expected] of [['2026-09-30T08:50:00Z','Hello, night owl'],['2026-09-30T14:00:00Z','Good morning'],['2026-09-30T20:00:00Z','Good afternoon'],['2026-10-01T02:00:00Z','Good evening'],['2026-10-01T05:00:00Z','Hello, night owl']])assert.equal(homeGreeting(new Date(utc),zone),expected);
 assert.equal(homeGreeting(new Date('2026-09-30T08:50:00Z'),'Asia/Tokyo'),'Good evening');
});
