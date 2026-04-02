I want to create a dashboard that shows the funding statistics of the Research Council of Norway. 
The dashboard should provide different views:

- a map of Norway showing the funding by city/municipality
- a diagram showing the funding by year
- funding by institutions
- funding by area of research
- funding by funding scheme
- etc...

The dashboard should be modern, interactive and easy to use. It should be possible to filter the data by year, region, institution, funding scheme, subject field, etc...

You can use as inspiration this: https://www.perplexity.ai/computer/a/d5611bd3-1778-42b1-9c02-92832724a849?view=split

or this: https://www.perplexity.ai/computer/a/275ed51b-a4db-4f69-9812-1709598550fc?view=split

or this: https://www.perplexity.ai/computer/a/399b0243-e137-4184-acaf-17c305c3e418?view=split

## data collection

The Research Council of Norway’s project information is publicly available through the Project Databank / Prosjektbanken, which provides access to figures, statistics, and detailed project information from 2004 onward. It is also published as an open dataset on data.norge.no.

What you can derive
You can derive statistics by year, geography/region, and organization, and the databank also supports categories such as ministry, funding scheme, county/municipality, and subject field. The databank documentation says the statistics view can be filtered by categories including organisation, county/municipality, and year, and the dataset description says the statistics are distributed by theme, year, geography, and organization.

Regions, institutions, sector
Yes, it should be possible to count funded projects by region, institution, and sector, because the databank explicitly supports geographic and organizational classification. The databank also explains that the “Organisation” category shows the project owner’s institution/company type and name, and that sector-level figures are based on the sector affiliation of the responsible institution.

Money allocated
Yes, you can also derive allocated amounts in NOK, including amounts in millions of NOK. The databank examples show funding amounts displayed in monetary terms and the statistics can be viewed at aggregated and detailed levels, so total NOK by region, institution, or sector is feasible if you extract the underlying records or use the statistics views.

Important caveat
One limitation is that the databank notes a project is typically attributed to the project owner only, not to collaborating institutions, so institution-based counts reflect the owner/institution recorded in the databank rather than every participant. It also notes that thematic classifications can overlap, so summed amounts across some thematic categories may exceed the project’s actual grant, but subject-field classification is designed not to exceed the real grant total.