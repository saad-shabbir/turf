import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { Animated, Image, Platform, ScrollView, Text, TextInput, View, StyleSheet, type ImageSourcePropType, type ViewStyle, type TextStyle } from "react-native";
import Svg, { Path, Circle, Line, Rect } from "react-native-svg";
import type { ThemeName } from "./model";
import {useReducedMotion,SoftPressable,Entrance} from './motion';

export const themes = {
  blush: { paper: "#F8EEEE", card: "#FFFBF9", ink: "#39292F", accent: "#A34C64", tint: "#F0D5DA", muted: "#80676D", line: "#EADADD" },
  sage: { paper: "#F1F3EA", card: "#FCFCF6", ink: "#2E352B", accent: "#566F4F", tint: "#DDE5D0", muted: "#6E7662", line: "#DEE3D4" },
  clay: { paper: "#F6F1E9", card: "#FFFCF7", ink: "#322C28", accent: "#A45338", tint: "#EEDDCB", muted: "#776D64", line: "#E7DED2" },
};
export const headingFont = Platform.OS === "android" ? "Fraunces_600SemiBold" : "Georgia";
const ThemeContext = createContext(themes.clay);
export const useTheme = () => useContext(ThemeContext);
export function Theme({ name, children }: { name: ThemeName; children: React.ReactNode }) { return <ThemeContext.Provider value={themes[name]}>{children}</ThemeContext.Provider>; }
export function Txt({ children, style, muted = false, bold = false, serif = false, numeric = false, size = 15, lines }: { children?: React.ReactNode; style?: TextStyle | TextStyle[]; muted?: boolean; bold?: boolean; serif?: boolean; numeric?: boolean; size?: number; lines?: number }) {
  const t = useTheme();
  return <Text numberOfLines={lines} style={[{ color: muted ? t.muted : t.ink, fontFamily: numeric ? "Manrope_600SemiBold" : serif ? headingFont : bold ? "Manrope_600SemiBold" : "Manrope_400Regular", fontWeight: !numeric && serif && Platform.OS !== "android" ? "600" : undefined, fontSize: size, lineHeight: size * (numeric ? 1.15 : serif ? 1.12 : 1.45), letterSpacing: numeric ? -size * 0.025 : serif ? -size * 0.035 : -0.15, fontVariant: ["tabular-nums"] }, style]}>{children}</Text>;
}
export const Row = ({ children, style }: { children: React.ReactNode; style?: ViewStyle }) => <View style={[{ flexDirection: "row", alignItems: "center", gap: 10 }, style]}>{children}</View>;
export function Card({ children, dark, style }: { children: React.ReactNode; dark?: boolean; style?: ViewStyle }) {
  const t = useTheme(); return <View style={[{ backgroundColor: dark ? t.ink : t.card, borderColor: dark ? t.ink : t.line, borderWidth: 0.7, borderRadius: 24, padding: 18 }, style]}>{children}</View>;
}
export function Button({ title, onPress, secondary, dark, icon, disabled, small, style }: { title: string; onPress: () => void; secondary?: boolean; dark?: boolean; icon?: string; disabled?: boolean; small?: boolean; style?: ViewStyle }) {
  const t = useTheme(); const color = secondary ? t.ink : "#fff";
  return <SoftPressable accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} style={({ pressed }) => [{ minHeight: small ? 44 : 58, paddingHorizontal: small ? 15 : 22, paddingVertical: 12, borderRadius: 99, backgroundColor: secondary ? t.card : dark ? t.ink : t.accent, borderWidth: secondary ? 1 : 0, borderColor: t.line, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.45 : pressed ? 0.92 : 1 }, style]}>
    <Row style={{ justifyContent: "center", gap: 8 }}>{icon && <Icon name={icon} size={16} color={color} />}<Txt bold size={small ? 12 : 16} style={{ color, textAlign: "center" }}>{title}</Txt></Row>
  </SoftPressable>;
}
export function Input({ label, value, onChange, placeholder, secure, keyboard, multiline }: { label?: string; value: string; onChange: (value: string) => void; placeholder?: string; secure?: boolean; keyboard?: "email-address" | "numeric" | "phone-pad"; multiline?: boolean }) {
  const t = useTheme(); return <View style={{ gap: 7 }}>{label && <Txt size={12} bold>{label}</Txt>}<TextInput accessibilityLabel={label ?? placeholder} value={value} onChangeText={onChange} placeholder={placeholder} secureTextEntry={secure} keyboardType={keyboard} autoCapitalize={keyboard === "email-address" ? "none" : "sentences"} multiline={multiline} placeholderTextColor={t.muted} style={{ backgroundColor: t.card, color: t.ink, borderWidth: 1, borderColor: t.line, borderRadius: 16, minHeight: multiline ? 96 : 54, paddingHorizontal: 16, paddingVertical: 12, fontFamily: "Manrope_400Regular", fontSize: 15 }} /></View>;
}
export function Chip({ title, selected, onPress, icon }: { title: string; selected?: boolean; onPress?: () => void; icon?: string }) {
  const t = useTheme(); return <SoftPressable accessibilityRole={onPress ? "button" : undefined} accessibilityState={{ selected }} onPress={onPress} disabled={!onPress} style={{ minHeight: onPress ? 44 : 28, paddingHorizontal: 13, paddingVertical: 6, borderRadius: 99, backgroundColor: selected ? t.tint : t.card, borderWidth: 1, borderColor: selected ? t.ink : t.line, alignItems: "center", justifyContent: "center" }}><Row style={{ gap: 5 }}>{icon && <Icon name={icon} size={13} />}<Txt size={12} bold>{title}</Txt></Row></SoftPressable>;
}
export function Avatar({ name, own = false, size = 34, source }: { name: string; own?: boolean; size?: number; source?: ImageSourcePropType }) { const t = useTheme(); return <View style={{ width: size, height: size, borderRadius: size, overflow: "hidden", backgroundColor: own ? t.accent : t.tint, alignItems: "center", justifyContent: "center" }}>{source ? <Image source={source} accessibilityLabel={`${name}'s profile photo`} style={{width: size, height: size}}/> : <Txt bold size={size * 0.39} style={{ color: own ? "#fff" : t.ink }}>{name.slice(0, 1).toUpperCase()}</Txt>}</View>; }
export function Logo({ white = false, size = 26 }: { white?: boolean; size?: number }) { const t = useTheme(); return <Row style={{ gap: 10 }}><Icon name="flame" size={size * 0.82} color={white ? "#fff" : t.accent} /><Txt serif size={size} style={{ color: white ? "#fff" : t.ink }}>ClassStreak</Txt></Row>; }
export function StreakFlame({streak,size=20,color}:{streak:number;size?:number;color?:string}){
 const reduced=useReducedMotion();const previous=useRef(streak);const [scale]=useState(()=>new Animated.Value(1));
 useEffect(()=>{if(streak>previous.current&&!reduced)Animated.sequence([Animated.timing(scale,{toValue:1.25,duration:180,useNativeDriver:true}),Animated.timing(scale,{toValue:1,duration:220,useNativeDriver:true})]).start();previous.current=streak;return()=>scale.stopAnimation();},[streak,reduced,scale]);
 return <Animated.View style={{transform:[{scale}]}}><Icon name="flame" size={size} color={color}/></Animated.View>;
}
export function Icon({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  const t = useTheme(); const paths: Record<string, string> = {
    flame: "M12 3c1 5 6 6 6 11a6 6 0 0 1-12 0c0-2 1-4 3-6 0 3 2 4 3 4 2-3 1-6 0-9Z",
    home: "m3 10 9-7 9 7v10h-6v-6H9v6H3Z", studio: "M4 10v11h16V10M3 4h18l1 6H2ZM8 21v-7h8v7",
    camera: "M3 7h5l2-3h4l2 3h5v14H3ZM16 14a4 4 0 1 0-8 0 4 4 0 0 0 8 0",
    friends: "M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm9 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM2 21v-3a6 6 0 0 1 12 0v3m1-7a5 5 0 0 1 7 4v3",
    person: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 22a8 8 0 0 1 16 0",
    bell: "M5 16V10a7 7 0 0 1 14 0v6l2 3H3Zm5 6h4", plus: "M12 4v16M4 12h16", minus: "M4 12h16", x: "m6 6 12 12M6 18 18 6",
    check: "m5 12 4 4L19 6", chevron: "m9 5 7 7-7 7", back: "m15 5-7 7 7 7",
    pin: "M19 10c0 6-7 12-7 12S5 16 5 10a7 7 0 0 1 14 0Zm-4 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0",
    search: "m16 16 5 5M18 10a8 8 0 1 0-16 0 8 8 0 0 0 16 0",
    reformer: "M3 17h18M5 13h14l2 4M6 9h12v4M4 9h16M7 17v3m10-3v3",
    mat: "M5 9h14a3 3 0 0 1 0 6H5a3 3 0 0 1 0-6Zm1 0v6",
    yoga: "M12 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm0 1v7m-7-4 7 2 7-2M8 22l4-7 4 7",
    bike: "M8 17a4 4 0 1 0-8 0 4 4 0 0 0 8 0Zm16 0a4 4 0 1 0-8 0 4 4 0 0 0 8 0ZM4 17 9 6h7l4 11M7 6h5m3-3h4",
    barre: "M2 6h20M6 6v16M18 6v16", bolt: "m14 2-10 12h7l-1 8 10-13h-7Z",
    glove: "M8 16c-2-1-4-3-4-6V7a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v3l1-2c.8-1.4 3-.8 3 1v3c0 2-1.5 3.5-3 4v5H8v-5Zm0 0h10M8 18h10M17 10l-2 3", dumbbell: "M8 7H4v10h4Zm12 0h-4v10h4ZM8 12h8M1 10v4m22-4v4",
    clock: "M22 12a10 10 0 1 0-20 0 10 10 0 0 0 20 0ZM12 6v6l4 3",
    lock: "M5 11h14v11H5ZM8 11V7a4 4 0 0 1 8 0v4",
    trophy: "M7 3h10v9a5 5 0 0 1-10 0ZM7 5H3v4a4 4 0 0 0 4 4m10-8h4v4a4 4 0 0 1-4 4m-5 4v5m-4 0h8",
    star: "m12 2 3 7 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1Z",
    share: "M12 16V2m-5 5 5-5 5 5M5 11H3v11h18V11h-2",
    comment: "M3 3h18v14H9l-6 5Z", edit: "m3 17 12-12 4 4L7 21H3Zm12-12 3-3 4 4-3 3",
    crown: "m2 6 5 5 5-8 5 8 5-5-3 14H5Z", link: "m10 8 4-4a5 5 0 0 1 7 7l-4 4m-3 1-4 4a5 5 0 0 1-7-7l4-4m1 7 8-8",
    mail: "M2 4h20v16H2Zm0 0 10 9L22 4", watch: "M8 6V1h8v5M8 18v5h8v-5M6 6h12v12H6Z",
    qr:"M3 3h6v6H3ZM15 3h6v6h-6ZM3 15h6v6H3ZM15 15h3v3h-3Zm3 3h3v3h-3M12 3v5m0 4h4m5 0v3M3 12h5m4 4v5",
    flag:"M5 22V3m0 0h7l2 3h7v10h-7l-2-3H5",
    calendar:"M4 5h16v16H4ZM8 2v6M16 2v6M4 10h16M8 14h1m3 0h1m3 0h1M8 18h1m3 0h1",
    heart:"M12 21 3.5 12.5a5.5 5.5 0 0 1 8.5-7 5.5 5.5 0 0 1 8.5 7Z",
    history:"M3 10a9 9 0 1 1 2 8M3 4v6h6M12 7v5l4 2",
    repeat:"m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3",
  };
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? t.ink} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><Path d={paths[name] ?? paths.star} /></Svg>;
}
const AnimatedCircle=Animated.createAnimatedComponent(Circle);
export function Ring({ count, goal }: { count: number; goal: number }) {
 const t=useTheme();const reduced=useReducedMotion();const [value]=useState(()=>new Animated.Value(count));const [display,setDisplay]=useState(count);
 useEffect(()=>{const id=value.addListener(e=>setDisplay(Math.round(e.value)));Animated.timing(value,{toValue:count,duration:reduced?0:300,useNativeDriver:false}).start();return()=>{value.removeListener(id);value.stopAnimation();};},[count,reduced,value]);
 return <View accessible accessibilityRole="progressbar" accessibilityLabel="This week's sessions" accessibilityValue={{min:0,max:Math.max(goal,count),now:count,text:`${count} of ${goal} sessions`}} style={{width:70,height:70,justifyContent:'center',alignItems:'center'}}><Svg width={70} height={70} style={StyleSheet.absoluteFill}><Circle cx={35} cy={35} r={29} stroke={t.line} strokeWidth={7} fill="none"/><AnimatedCircle cx={35} cy={35} r={29} stroke={t.accent} strokeWidth={7} fill="none" strokeDasharray="182.2 182.2" strokeDashoffset={value.interpolate({inputRange:[0,Math.max(1,goal)],outputRange:[182.2,0],extrapolate:'clamp'})} rotation={-90} origin="35,35"/></Svg><Txt bold size={13}>{display}/{goal}</Txt></View>;
}
export function Screen({ children, header, footer, scroll = true, style }: { children: React.ReactNode; header?: React.ReactNode; footer?: React.ReactNode; scroll?: boolean; style?: ViewStyle }) {
  const t = useTheme(); const inner = <View style={[{ flexGrow: 1, padding: 22, gap: 20 }, style]}>{children}</View>;
  return <Entrance><View style={{ flex: 1, backgroundColor: t.paper }}>{header}{scroll ? <ScrollView automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>{inner}</ScrollView> : inner}{footer && <View style={{ paddingHorizontal: 22, paddingBottom: 18, paddingTop: 12, gap: 9, backgroundColor: t.paper }}>{footer}</View>}</View></Entrance>;
}
export function Empty({ title, body, action, onPress }: { title: string; body: string; action?: string; onPress?: () => void }) { return <Card style={{ gap: 12 }}><Icon name="flame" size={32}/><Txt serif size={25}>{title}</Txt><Txt muted>{body}</Txt>{action && onPress && <Button title={action} onPress={onPress} />}</Card>; }
export function Divider() { const t = useTheme(); return <View style={{ height: 1, backgroundColor: t.line }} />; }
export function Chart({ values }: { values: number[] }) { const t = useTheme(); const max = Math.max(4, ...values); return <Svg width="100%" height={70} viewBox="0 0 300 70">{values.map((v, i) => <Rect key={i} x={i * 25} y={68 - v / max * 58} width={18} height={Math.max(3, v / max * 58)} rx={5} fill={i === values.length - 1 ? t.accent : t.tint} />)}<Line x1={0} x2={300} y1={69} y2={69} stroke={t.line} /></Svg>; }
