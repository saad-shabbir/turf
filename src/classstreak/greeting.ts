export function homeGreeting(now:Date,timeZone:string):string{
 const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone,hour:'numeric',hourCycle:'h23'}).format(now));
 if(hour<5||hour>=22)return 'Hello, night owl';
 if(hour<12)return 'Good morning';
 if(hour<17)return 'Good afternoon';
 return 'Good evening';
}
