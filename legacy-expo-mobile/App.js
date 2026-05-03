import { StatusBar } from "react-native";
import MapScreen from "./src/screens/MapScreen";

export default function App() {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <MapScreen />
    </>
  );
}
