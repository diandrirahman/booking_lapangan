import { Heart } from "lucide-react";
import { usePrototype } from "../store/PrototypeStore";

export function MabarFavoriteButton({
  mabarId,
  title,
}: {
  mabarId: string;
  title: string;
}) {
  const { state, dispatch } = usePrototype();
  const isFavorite = state.favoriteMabarIds.includes(mabarId);

  return (
    <button
      type="button"
      className={`favorite-button mabar-favorite-button ${isFavorite ? "active" : ""}`}
      aria-label={
        isFavorite
          ? `Hapus ${title} dari favorit`
          : `Simpan ${title} ke favorit`
      }
      aria-pressed={isFavorite}
      onClick={() =>
        dispatch({
          type: "TOGGLE_FAVORITE",
          resource: "mabar",
          resourceId: mabarId,
        })
      }
    >
      <Heart fill={isFavorite ? "currentColor" : "none"} />
    </button>
  );
}
