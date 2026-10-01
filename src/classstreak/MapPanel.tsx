import React from "react";
import { View } from "react-native";
import MapView, { Circle, Marker } from "react-native-maps";
export type MapPanelProps = { latitude: number; longitude: number; radius: number; onPin: (lat: number, lng: number) => void };
export default function MapPanel({ latitude, longitude, radius, onPin }: MapPanelProps) {
  return <View style={{ height: 250, borderRadius: 18, overflow: "hidden" }}><MapView accessibilityLabel="Map. Tap to place your studio pin." style={{ flex: 1 }} region={{ latitude, longitude, latitudeDelta: 0.012, longitudeDelta: 0.012 }} onPress={e => onPin(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}><Circle center={{ latitude, longitude }} radius={radius} fillColor="#CF2E6622" strokeColor="#CF2E66" /><Marker draggable coordinate={{ latitude, longitude }} onDragEnd={e => onPin(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)} /></MapView></View>;
}
