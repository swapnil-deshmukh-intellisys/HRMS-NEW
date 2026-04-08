import { memo, useEffect, useMemo, useState } from "react";
import "./TimeCard.css";

type TimeCardProps = {
  timezone: string;
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

  return region ? `${city}, ${region}` : city;
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

function AnalogClock({ timezone, now }: AnalogClockProps) {
  const parts = useMemo(() => getZonedParts(now, timezone), [now, timezone]);
  const secondRotation = parts.second * 6;
  const minuteRotation = parts.minute * 6 + parts.second * 0.1;
  const hourRotation = (parts.hour % 12) * 30 + parts.minute * 0.5;

  return (
    <div className="time-card__analog" aria-hidden="true">
      <div className="time-card__dial">
        <span className="time-card__tick time-card__tick--top" />
        <span className="time-card__tick time-card__tick--right" />
        <span className="time-card__tick time-card__tick--bottom" />
        <span className="time-card__tick time-card__tick--left" />
        <span className="time-card__hand time-card__hand--hour" style={{ transform: `translateX(-50%) rotate(${hourRotation}deg)` }} />
        <span className="time-card__hand time-card__hand--minute" style={{ transform: `translateX(-50%) rotate(${minuteRotation}deg)` }} />
        <span className="time-card__hand time-card__hand--second" style={{ transform: `translateX(-50%) rotate(${secondRotation}deg)` }} />
        <span className="time-card__center-dot" />
      </div>
    </div>
  );
}

const MemoizedAnalogClock = memo(AnalogClock);

export default function TimeCard({ timezone }: TimeCardProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const locationLabel = useMemo(() => getReadableLocationLabel(timezone), [timezone]);
  const timeLabel = useMemo(() => getDisplayFormatter(timezone).format(now), [now, timezone]);
  const offsetLabel = useMemo(() => formatOffsetLabel(now, timezone), [now, timezone]);

  return (
    <article className="time-card">
      <div className="time-card__content">
        <div className="time-card__details">
          <strong className="time-card__time">{timeLabel}</strong>
          <span className="time-card__location">{locationLabel}</span>
          <span className="time-card__offset">{offsetLabel}</span>
        </div>
        <MemoizedAnalogClock timezone={timezone} now={now} />
      </div>
    </article>
  );
}
