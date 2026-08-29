import { CheckCircle2, MessageSquareText, Star } from "lucide-react";
import { ratingDistribution, reviewPresentations } from "../data/reviewPresentations";

export function VenueReviews({
  venueName,
  rating,
  reviewCount,
}: {
  venueName: string;
  rating: number;
  reviewCount: number;
}) {
  return (
    <section className="venue-reviews" aria-labelledby="venue-reviews-title">
      <div className="review-section-heading">
        <div>
          <p className="eyebrow">Pengalaman pemain</p>
          <h2 id="venue-reviews-title">Ulasan untuk {venueName}</h2>
          <p>Ringkasan berasal dari booking yang telah selesai.</p>
        </div>
        <span className="review-verified-label">
          <CheckCircle2 /> Booking terverifikasi
        </span>
      </div>

      <div className="review-overview-card">
        <div className="review-score">
          <strong>{rating.toFixed(1)}</strong>
          <StarRating rating={Math.round(rating)} label={`${rating} dari 5`} />
          <span>{reviewCount} ulasan pemain</span>
        </div>
        <div className="rating-distribution" aria-label="Distribusi rating">
          {ratingDistribution.map((item) => (
            <div key={item.stars} className="rating-distribution-row">
              <span>{item.stars}</span>
              <Star aria-hidden="true" />
              <div className="rating-track">
                <span style={{ width: `${item.percentage}%` }} />
              </div>
              <small>{item.percentage}%</small>
            </div>
          ))}
        </div>
        <div className="review-highlights">
          <span>Paling sering disebut</span>
          <div>
            <strong>Court terawat</strong>
            <strong>Staf membantu</strong>
            <strong>Check-in cepat</strong>
          </div>
        </div>
      </div>

      <div className="review-card-grid">
        {reviewPresentations.map((review) => (
          <article className="review-card" key={review.id}>
            <div className="review-card-header">
              <span className="review-avatar" aria-hidden="true">
                {initials(review.author)}
              </span>
              <div>
                <strong>{review.author}</strong>
                <small>{review.court}</small>
              </div>
              <time>{review.date}</time>
            </div>
            <StarRating rating={review.rating} label={`${review.rating} dari 5`} />
            <p>“{review.comment}”</p>
            <div className="review-tags">
              {review.highlights.map((highlight) => (
                <span key={highlight}>{highlight}</span>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="review-note">
        <MessageSquareText />
        <p>
          Ulasan hanya dapat diberikan setelah jadwal bermain selesai. Pembuatan dan
          moderasi ulasan penuh tersedia pada Phase B2.
        </p>
      </div>
    </section>
  );
}

export function StarRating({ rating, label }: { rating: number; label: string }) {
  return (
    <span className="star-rating" role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          aria-hidden="true"
          className={index < rating ? "filled" : undefined}
        />
      ))}
    </span>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
