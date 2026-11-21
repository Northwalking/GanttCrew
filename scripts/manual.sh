#!/bin/sh
# Builds the HTML user manuals from docs/manual.*.md (the same text that GitHub shows).
# Needs pandoc. The HTML files are committed so that the repository and the installation package carry
# exactly the same manual.
set -e
cd "$(dirname "$0")/.."
REPO=https://github.com/Northwalking/GanttCrew/blob/main/docs
for l in es en; do
  if [ "$l" = es ]; then t="Manual de usuario de GanttCrew"; o=en; else t="GanttCrew user manual"; o=es; fi
  pandoc "docs/manual.$l.md" -o "docs/manual.$l.html" --standalone --embed-resources \
    --resource-path=docs --css=scripts/manual.css --metadata pagetitle="$t" --metadata lang="$l" --metadata author="Schon LIANG" \
    --shift-heading-level-by=0
  # the other language and the formulas live on GitHub
  sed -i "s#href=\"manual\.$o\.md\"#href=\"$REPO/manual.$o.md\"#g" "docs/manual.$l.html"
done
echo "docs/manual.es.html, docs/manual.en.html"
