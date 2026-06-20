update public.rotation_versions
set pattern = array[
  pattern[1],
  pattern[2],
  pattern[3],
  pattern[4],
  pattern[5],
  pattern[6],
  coalesce(pattern[7], 'weekend')
]
where array_length(pattern, 1) is distinct from 7;
