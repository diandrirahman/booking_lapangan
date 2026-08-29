import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Images, X } from "lucide-react";
import { useState, type PointerEvent } from "react";

interface InteractiveGalleryProps {
  images: string[];
  venueName: string;
}

function updateTilt(event: PointerEvent<HTMLButtonElement>) {
  const target = event.currentTarget;
  const bounds = target.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width - 0.5;
  const y = (event.clientY - bounds.top) / bounds.height - 0.5;
  target.style.setProperty("--gallery-rotate-x", `${y * -5}deg`);
  target.style.setProperty("--gallery-rotate-y", `${x * 6}deg`);
}

function resetTilt(event: PointerEvent<HTMLButtonElement>) {
  event.currentTarget.style.removeProperty("--gallery-rotate-x");
  event.currentTarget.style.removeProperty("--gallery-rotate-y");
}

// Adapted from the 3D Gallery and Gallery Grid with Lightbox collections on 21st.dev.
export function InteractiveGallery({ images, venueName }: InteractiveGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [open, setOpen] = useState(false);

  function openImage(index: number) {
    setActiveIndex(index);
    setOpen(true);
  }

  function move(direction: -1 | 1) {
    setActiveIndex((current) => (current + direction + images.length) % images.length);
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <div className="gallery-grid gallery-3d">
        {images.slice(0, 3).map((image, index) => (
          <button
            type="button"
            key={`${image}-${index}`}
            className={index === 0 ? "gallery-main" : ""}
            onClick={() => openImage(index)}
            onPointerMove={updateTilt}
            onPointerLeave={resetTilt}
          >
            <img
              src={image}
              alt={`${venueName}, tampilan fasilitas ${index + 1}`}
              loading={index === 0 ? "eager" : "lazy"}
            />
            <span className="gallery-depth" aria-hidden="true" />
          </button>
        ))}
        <button type="button" className="gallery-count" onClick={() => openImage(0)}>
          <Images /> 12 foto
        </button>
      </div>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="gallery-lightbox">
          <Dialog.Title>{`Galeri ${venueName}`}</Dialog.Title>
          <Dialog.Description>
            Gunakan tombol panah untuk melihat foto venue.
          </Dialog.Description>
          <img
            src={images[activeIndex]}
            alt={`${venueName}, foto ${activeIndex + 1}`}
          />
          <button
            type="button"
            className="gallery-nav previous"
            onClick={() => move(-1)}
            aria-label="Foto sebelumnya"
          >
            <ChevronLeft />
          </button>
          <button
            type="button"
            className="gallery-nav next"
            onClick={() => move(1)}
            aria-label="Foto berikutnya"
          >
            <ChevronRight />
          </button>
          <Dialog.Close className="icon-button gallery-close" aria-label="Tutup galeri">
            <X />
          </Dialog.Close>
          <span className="gallery-position">
            {activeIndex + 1} / {images.length}
          </span>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
