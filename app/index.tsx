import { AppScreen } from "@/src/components/AppScreen";
import { LoadingView } from "@/src/components/StateView";
import { useAuth } from "@/src/context/AuthContext";
import { Redirect } from "expo-router";

export default function IndexScreen() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <AppScreen>
        <LoadingView message="Đang khởi động PenguinLingo..." />
      </AppScreen>
    );
  return <Redirect href={user ? "/(tabs)" : "/(auth)/login"} />;
}
