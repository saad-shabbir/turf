export type WorkoutActivityProps={label:string;startedAt:number;count:number;goal:number;accent:string};
export type WorkoutActivityInstance={getId:()=>string;update:(props:WorkoutActivityProps,staleDate:Date)=>Promise<void>;end:(policy:'immediate')=>Promise<void>};
export const workoutActivityDriver:{supported:boolean;list:()=>WorkoutActivityInstance[];start:(props:WorkoutActivityProps,staleDate:Date)=>WorkoutActivityInstance}={supported:false,list:()=>[],start:()=>{throw new Error('Live Activities are only available on iPhone.');}};
