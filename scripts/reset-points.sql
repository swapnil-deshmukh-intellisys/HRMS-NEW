-- Preview: Find the employees first
SELECT e.id, e."firstName", e."lastName", e.points
FROM "Employee" e
WHERE
  (e."firstName" ILIKE 'Gaurav' AND e."lastName" ILIKE 'Ramane')
  OR (e."firstName" ILIKE 'Ritesh' AND e."lastName" ILIKE 'Jawale');
