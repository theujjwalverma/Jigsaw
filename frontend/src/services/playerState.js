import { api } from "./api";
import { useGameStore } from "./gameState";

export async function restorePlayerState(eventId, playerId) {
  const isCurrentSession = () => {
    const state = useGameStore.getState();
    return state.eventId === eventId && state.playerId === playerId;
  };
  try {
    const { data } = await api.get(`/events/${eventId}/state/${playerId}`);
    if (isCurrentSession()) useGameStore.getState().restoreState(data);
  } catch (error) {
    if (isCurrentSession()) {
      useGameStore.getState().setConnectionError(
        error.response?.data?.error || "Unable to load the puzzle. Check your connection and retry.",
      );
    }
  }
}
