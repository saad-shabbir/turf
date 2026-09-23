import React, { useState,useEffect,useRef } from "react";
import { Pressable, Switch, View, LayoutAnimation } from "react-native";
import * as Location from "expo-location";
import { activities, activity, type Place, type ActivityKey } from "./model";
import { Button, Card, Chip, Icon, Input, Row, Txt } from "./ui";
import MapPanel from "./MapPanel";
import {useReducedMotion} from "./motion";
type SearchResult = { id: string; displayName: { text: string }; formattedAddress?: string; location: { latitude: number; longitude: number }; types?: string[] };
const googleKey = process.env.EXPO_PUBLIC_GOOGLE_PLACES_KEY ?? "";
export function PlacesPicker({ value, onSelect, onError, preview = false, choices=activities.map(a=>a.key) }: { value: Place | null; onSelect: (place: Place) => void; onError: (error: unknown) => void; preview?: boolean; choices?:ActivityKey[] }) {
  const reduced=useReducedMotion();
  const [query, setQuery] = useState(value?.name ?? "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved,setSaved]=useState(false);const saveTimer=useRef<ReturnType<typeof setTimeout>|null>(null);useEffect(()=>()=>{if(saveTimer.current)clearTimeout(saveTimer.current);},[]);
  const [editing, setEditing] = useState<Place | null>(value);
  const [pinConfirmed, setPinConfirmed] = useState(!!value);
  const [fallback, setFallback] = useState(!googleKey);
  const defaults: Place = { id: "", name: query, activity_key: "reformer", lat: 36.17, lng: -115.28, radius_m: 100, enabled: true, share_name: true };
  const search = async () => {
    if (!query.trim()) return;
    if (preview) { setResults([{ id: /core|suwanee/i.test(query)?"preview-core":"preview-venue", displayName: { text: /core|suwanee/i.test(query)?"Core Pilates Studio — Suwanee":"Club Pilates Summerlin" }, formattedAddress: "Sample search result", location: { latitude: /core|suwanee/i.test(query)?34.05:36.17, longitude: /core|suwanee/i.test(query)?-84.15:-115.28 } }]); return; }
    if (!googleKey) { setEditing({ ...defaults, name: query }); setFallback(true); return; }
    setBusy(true);
    try {
      const response = await fetch("https://places.googleapis.com/v1/places:searchText", { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": googleKey, "X-Ios-Bundle-Identifier": "com.turf.privatealpha", "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.types" }, body: JSON.stringify({ textQuery: query, pageSize: 6 }), signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error("Search isn't available. You can still choose a pin on the map.");
      const body = await response.json() as { places?: SearchResult[] }; setResults(body.places ?? []);
      if (!body.places?.length) setFallback(true);
    } catch (e) { setFallback(true); onError(e); } finally { setBusy(false); }
  };
  const choose = (r: SearchResult) => {
    const name = r.displayName.text;
    const key: ActivityKey = /pilates|lagree|reformer|solidcore|core/i.test(name) ? "reformer" : r.types?.includes("yoga_studio") ? "yoga" : "gym";
    setEditing({ ...defaults, name, google_place_id: r.id, lat: r.location.latitude, lng: r.location.longitude, activity_key: key, radius_m: key === "gym" ? 150 : 100 }); setPinConfirmed(true); setResults([]);
  };
  const current = editing ?? defaults;
  return <View style={{ gap: 12 }}>
    <Input placeholder="Search by studio name or address" value={query} onChange={setQuery} /><Button secondary small title={busy ? "Searching…" : "Search"} icon="search" onPress={() => void search()} disabled={busy} />
    {!editing && !results.length && <Pressable onPress={() => setQuery("Core Pilates Studio Suwanee")}><Txt muted size={12}>Suggested search: Core Pilates Studio — Suwanee</Txt></Pressable>}
    {results.map(r => <Pressable key={r.id} onPress={() => choose(r)}><Card style={{ borderRadius: 17, padding: 13 }}><Row><Icon name={/pilates/i.test(r.displayName.text) ? "reformer" : "dumbbell"} /><View style={{ flex: 1 }}><Txt bold size={14}>{r.displayName.text}</Txt><Txt muted size={11}>{r.formattedAddress}</Txt></View><Icon name="chevron" size={15} /></Row></Card></Pressable>)}
    {(editing || fallback) && <><Input label="Studio or gym name" value={current.name} onChange={name => setEditing({ ...current, name })} /><MapPanel latitude={current.lat} longitude={current.lng} radius={current.radius_m} onPin={(lat, lng) => { setEditing({ ...current, lat, lng }); setPinConfirmed(true); }} /><Txt size={12} muted>Tap the map or drag the pin to your entrance. The circle is your arrival area.</Txt><Button secondary small title="Use my current location" icon="pin" onPress={() => { if (preview) { setPinConfirmed(true); return; } void (async () => { const permission = await Location.getForegroundPermissionsAsync(); if (permission.status !== "granted") throw new Error("Choose a pin now. Location permission comes in the next setup step."); const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); setEditing({ ...current, lat: p.coords.latitude, lng: p.coords.longitude }); setPinConfirmed(true); })().catch(onError); }} /><Row style={{ flexWrap: "wrap", gap: 6 }}>{[75, 100, 150, 250, 400].map(radius => <Chip key={radius} title={`${radius} m`} selected={current.radius_m === radius} onPress={() => setEditing({ ...current, radius_m: radius })} />)}</Row><Row style={{ flexWrap: "wrap", gap: 6 }}>{choices.map(activity).map(a => <Chip key={a.key} title={a.short} selected={current.activity_key === a.key} onPress={() => setEditing({ ...current, activity_key: a.key })} />)}</Row><Button title={saved?"Saved ✓":value ? "Save place" : "Use this place"} disabled={saved || !pinConfirmed || !current.name.trim()} onPress={() => {setSaved(true);saveTimer.current=setTimeout(()=>{if(!reduced)LayoutAnimation.configureNext({...LayoutAnimation.Presets.easeInEaseOut,duration:200});onSelect(current);setSaved(false);setEditing(null);setQuery("");setPinConfirmed(false);},350);}} /></>}
    {value && !editing && <Card><Txt bold>{value.name}</Txt><Txt muted size={12}>{activity(value.activity_key).label} · saved</Txt></Card>}
    {(editing||fallback)&&<Card><Row><Txt size={13} style={{flex:1}}>Share this place name with friends</Txt><Switch accessibilityLabel="Share this place name with friends" value={current.share_name} onValueChange={share_name=>setEditing({...current,share_name})}/></Row></Card>}
    <Card><Row style={{ alignItems: "flex-start" }}><Icon name="pin" size={14} /><Txt muted size={12} style={{ flex: 1 }}>We only pay attention here. When you’re at this studio or gym, ClassStreak notes that you came and how long you stayed — that’s your workout, logged. Everywhere else, we’re not looking.</Txt></Row></Card>
  </View>;
}
