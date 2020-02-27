{%- set sections = ["Security", "Warnings", "What's new?", "Bug fixes"] -%}
{%- set itemTypes = ["Resource Type", "Control Type", "Policy Type", "Action Type"] -%}
{%- set changeTypes = ["Added", "Renamed", "Removed"] -%}

{% for releaseNote in releaseNotes %}

{%- set version = releaseNote.version -%}
{%- set date = releaseNote.date -%}
{%- set notes = releaseNote.notes -%}
{%- set details = releaseNote.details -%}

{#- TODO: How to fix starting new line? -#}
{% if not loop.first %}

{% endif %}
# {{ version }} ({{ date }})

{#- Render sections -#}

{%- for section in sections %}

{%- if notes[section] | length > 0 %}

## {{ section|safe }}

{%- for note in notes[section] %}
- {{ note|safe }}
{%- endfor -%} {#- Note loop -#}
{%- endif %} {#- Section length > 0 -#}

{%- endfor -%} {#- Section loop -#}

{#- Render resource, control, action, and policy changes -#}

{%- for itemType in itemTypes %}

{%- if (details[itemType]["added"] | length > 0) or (details[itemType]["renamed"] | length > 0) or (details[itemType]["removed"] | length > 0) %}

### {{ itemType }}s

{%- for changeType in changeTypes %}

{%- if details[itemType][changeType|lower] | length > 0 %}

**{{ changeType }}**
{% for type in details[itemType][changeType|lower] -%}
{%- if changeType == "Renamed" %}
- {{ type.OldPath|safe }} to {{ type.Path|safe }}
{%- else %}
- {{ type.Path|safe }}
{%- endif %} {#- Change type conditional -#}
{% endfor -%} {#- Type loop -#}
{%- endif %} {#- Change type length > 0 conditional -#}

{% endfor %} {#- Change type loop -#}
{%- endif %} {#- Added/renamed/removed > 0 loop -#}

{% endfor %} {#- Item type loop -#}

{% endfor %} {#- Release notes loop -#}
