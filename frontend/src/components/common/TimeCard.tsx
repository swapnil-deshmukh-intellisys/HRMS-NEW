import { memo, useEffect, useMemo, useState } from "react";
import "./TimeCard.css";

type TimeCardProps = {
  timezone: string;
  now?: Date;
  variant?: "default" | "minimal";
  children?: React.ReactNode;
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

type AnalogClockProps = {
  timezone: string;
  now: Date;
};

const displayFormatterCache = new Map<string, Intl.DateTimeFormat>();
const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function getDisplayFormatter(timezone: string) {
  const cacheKey = `display:${timezone}`;

  if (!displayFormatterCache.has(cacheKey)) {
    displayFormatterCache.set(
      cacheKey,
      new Intl.DateTimeFormat(undefined, {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    );
  }

  return displayFormatterCache.get(cacheKey)!;
}

function getPartsFormatter(timezone: string) {
  const cacheKey = `parts:${timezone}`;

  if (!partsFormatterCache.has(cacheKey)) {
    partsFormatterCache.set(
      cacheKey,
      new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }),
    );
  }

  return partsFormatterCache.get(cacheKey)!;
}

function getZonedParts(date: Date, timezone: string): ZonedParts {
  const parts = getPartsFormatter(timezone).formatToParts(date);

  const readPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: readPart("year"),
    month: readPart("month"),
    day: readPart("day"),
    hour: readPart("hour"),
    minute: readPart("minute"),
    second: readPart("second"),
  };
}

function getReadableLocationLabel(timezone: string) {
  const segments = timezone.split("/");
  const city = segments[segments.length - 1]?.replace(/_/g, " ") ?? timezone;
  const region = segments.length > 1 ? segments[0].replace(/_/g, " ") : "";

  return { city, region };
}

function formatOffsetLabel(now: Date, timezone: string) {
  const targetParts = getZonedParts(now, timezone);
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const localParts = getZonedParts(now, localTimezone);

  const targetUtc = Date.UTC(
    targetParts.year,
    targetParts.month - 1,
    targetParts.day,
    targetParts.hour,
    targetParts.minute,
    targetParts.second,
  );
  const localUtc = Date.UTC(
    localParts.year,
    localParts.month - 1,
    localParts.day,
    localParts.hour,
    localParts.minute,
    localParts.second,
  );

  const diffMinutes = Math.round((targetUtc - localUtc) / 60000);
  const sign = diffMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(diffMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;

  return `Today, ${sign}${hours} hrs ${minutes} mins`;
}

function AnalogClock({ timezone, now, variant = "default" }: AnalogClockProps & { variant?: "default" | "minimal" }) {
  const parts = useMemo(() => getZonedParts(now, timezone), [now, timezone]);
  const secondRotation = parts.second * 6;
  const minuteRotation = parts.minute * 6 + parts.second * 0.1;
  const hourRotation = (parts.hour % 12) * 30 + parts.minute * 0.5;

  return (
    <div className="time-card__analog" aria-hidden="true">
      <div className="time-card__case">
        <div className="time-card__dial">
          {(() => {
            const tickCount = variant === "minimal" ? 4 : 12;
            const angleStep = 360 / tickCount;
            return [...Array(tickCount)].map((_, i) => (
              <span 
                key={i} 
                className="time-card__tick" 
                style={{ transform: `translateX(-50%) rotate(${i * angleStep}deg)` }} 
              />
            ));
          })()}
          
          {variant === "default" && (
            <div className="time-card__numbers">
              {[...Array(12)].map((_, i) => (
                <div key={i + 1} className="time-card__number-wrap" style={{ transform: `translateX(-50%) rotate(${(i + 1) * 30}deg)` }}>
                  <span className="time-card__number" style={{ transform: `translate(-50%, -50%) rotate(${-(i + 1) * 30}deg)` }}>{i + 1}</span>
                </div>
              ))}
            </div>
          )}

          <span className="time-card__hand time-card__hand--hour" style={{ transform: `translateX(-50%) rotate(${hourRotation}deg)` }} />
          <span className="time-card__hand time-card__hand--minute" style={{ transform: `translateX(-50%) rotate(${minuteRotation}deg)` }} />
          <span className="time-card__hand time-card__hand--second" style={{ transform: `translateX(-50%) rotate(${secondRotation}deg)` }} />
          <span className="time-card__center-dot" />
        </div>
      </div>
    </div>
  );
}

const MemoizedAnalogClock = memo(AnalogClock);

export default function TimeCard({ timezone, now: externalNow, variant = "default", children }: TimeCardProps) {
  const [internalNow, setInternalNow] = useState(() => new Date());

  useEffect(() => {
    if (externalNow) return;
    const intervalId = window.setInterval(() => {
      setInternalNow(new Date());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [externalNow]);

  const now = externalNow || internalNow;

  const locationLabel = useMemo(() => getReadableLocationLabel(timezone), [timezone]);
  const timeLabel = useMemo(() => getDisplayFormatter(timezone).format(now), [now, timezone]);
  const offsetLabel = useMemo(() => formatOffsetLabel(now, timezone), [now, timezone]);

  return (
    <article className={`time-card ${variant === "minimal" ? "time-card--minimal" : ""}`}>
      {children}
      <div className="time-card__content">
        <div className="time-card__details">
          <strong className="time-card__time">{timeLabel}</strong>
          <span className="time-card__location">
            {locationLabel.city}
            {locationLabel.region && (
              <>
                {", "}
                <span className="time-card__region">{locationLabel.region}</span>
              </>
            )}
          </span>
          <span className="time-card__offset">{offsetLabel}</span>
        </div>
        <MemoizedAnalogClock timezone={timezone} now={now} variant={variant} />
      </div>
    </article>
  );
}
