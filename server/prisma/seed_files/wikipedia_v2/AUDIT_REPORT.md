# Wikipedia Wrongful Convictions Audit & Ingest Report (`wikipedia_v2`)

Generated: 2026-11-23T14:55:39.454Z

## Summary Metrics
- **Raw Wikipedia CSV rows:** 340
- **Cleaned Individual Records (`all_wikipedia_individuals_bundle.json`):** 339
- **Excluded Group Rows (not single individuals):** 1
- **Matched to NRE v2 (safe MERGE/enrichment):** 270
- **Wikipedia-Only New Individuals (`wikipedia_only_new_bundle.json`):** 69
- **Truncated / Prefixed Names Fixed:** 4
- **Nickname Aliases Mapped to Canonical NRE Names (duplicates prevented):** 13
- **Blank Summary Rows Flagged:** 24

## 1. Truncated / Prefixed Names Fixed
| Row | Original CSV Name | Corrected Name |
| --- | --- | --- |
| 22 | Thomas | **Thomas Griffin** |
| 208 | Dan | **Dan Keller** |
| 235 | West Memphis Three:Damien Echols | **Damien Echols** |
| 295 | Richard | **Richard Winfrey** |

## 2. Group Rows Excluded (Add via Individual Groups Instead)
- Row 33: **Scottsboro Boys** (Mar 24, 1931, Paint Rock, Alabama)

## 3. Nickname Aliases Resolved to Canonical NRE Names
| Row | Wikipedia Name | Canonical NRE Name |
| --- | --- | --- |
| 46 | Sam Sheppard | **Samuel Sheppard** |
| 115 | Nick Yarris | **Nicholas Yarris** |
| 117 | Ron Williamson | **Ronald Williamson** |
| 153 | Kathy Gonzalez | **Kathleen Gonzalez** |
| 164 | Tim Cole | **Timothy Cole** |
| 175 | Tim Masters | **Timothy Masters** |
| 185 | Chris Ochoa | **Christopher Ochoa** |
| 208 | Dan Keller | **Daniel Keller** |
| 210 | Francisco Carrillo | **Franky Carrillo** |
| 243 | Ken Wyniemko | **Kenneth Wyniemko** |
| 284 | Cal Harris | **Calvin Harris** |
| 321 | Russ Faria | **Russell Faria** |
| 328 | Greg Kelley | **Gregory Kelley** |

## 4. Non-Standard Exoneration Statuses Normalized
| Row | Name | Raw Status | Mapped Status |
| --- | --- | --- | --- |
| 98 | John Stoll | Some | `UNKNOWN` |
| 188 | Bob Kelly | Varied | `UNKNOWN` |
| 189 | Betsy Kelly | Varied | `UNKNOWN` |
| 247 | Gene Town | (blank) | `UNKNOWN` |
| 248 | Cherie Town | (blank) | `UNKNOWN` |
| 249 | Selid Holt | (blank) | `UNKNOWN` |
| 335 | Alex Heineman | Partially(Original conviction vacated) | `CONVICTION_OVERTURNED` |

## 5. Wikipedia-Only New Individuals (69)
| Row | Name | Crime Date (Raw) | Location | Status | Crime Category |
| --- | --- | --- | --- | --- | --- |
| 1 | **Dominic Daley** | Nov 12, 1805 | Wilbraham, Massachusetts | `EXONERATED` | Murder |
| 2 | **James Halligan** | Nov 12, 1805 | Wilbraham, Massachusetts | `EXONERATED` | Murder |
| 5 | **John Gordon** | Dec 31, 1843 | Knightsville, Rhode Island | `EXONERATED` | Murder |
| 6 | **Chief Leschi** | 1855 | Olympia, Washington Territory | `CONVICTED` | Murder |
| 7 | **Jack Kehoe** | 1862 | Pennsylvania | `EXONERATED` | Murder |
| 8 | **Chipita Rodriguez** | 1863 | San Patricio, Texas | `EXONERATED` | Murder |
| 10 | **Oscar Neebe** | May 4, 1886 | Chicago, Illinois | `EXONERATED` | Other |
| 11 | **Michael Schwab** | May 4, 1886 | Chicago, Illinois | `EXONERATED` | Other |
| 12 | **Samuel Fielden** | May 4, 1886 | Chicago, Illinois | `EXONERATED` | Other |
| 13 | **Charles Hudspeth** | 1887 | Arkansas | `CONVICTED` | Murder |
| 15 | **George Davis** | Aug 9, 1894 | Lincoln, Nebraska | `EXONERATED` | Supporting Terrorism |
| 16 | **Nellie Pope** | 1895 | Detroit, Michigan | `EXONERATED` | Murder |
| 17 | **Jack Davis** | 1896 | Silver City, Idaho | `EXONERATED` | Murder |
| 18 | **Caleb Powers** | 1900 | Frankfort, Kentucky | `EXONERATED` | Murder |
| 19 | **Ed Johnson** | Feb 11, 1906 | Chattanooga, Tennessee | `EXONERATED` | Sexual Assault |
| 20 | **William Walters** | 1912 | Louisiana | `EXONERATED` | Kidnapping |
| 21 | **Bill Wilson** | 1912 | Alabama | `EXONERATED` | Murder |
| 22 | **Thomas Griffin** | 1913 | South Carolina | `EXONERATED` | Murder |
| 23 | **Meeks Griffin** | 1913 | South Carolina | `EXONERATED` | Murder |
| 24 | **Leo Frank** | 1913 | Marietta, Georgia | `RELEASED_CLEMENCY` | Murder |
| 25 | **Joe Hill** | 1914 | Salt Lake City, Utah | `CONVICTED` | Murder |
| 27 | **Nicola Sacco** | 1920 | Braintree, Massachusetts | `RELEASED_CLEMENCY` | Robbery |
| 28 | **Bartolomeo Vanzetti** | 1920 | Braintree, Massachusetts | `RELEASED_CLEMENCY` | Robbery |
| 32 | **Alexander Williams** | Oct 3, 1930 | Pennsylvania | `EXONERATED` | Murder |
| 36 | **Joe Arridy** | Aug 26, 1936 | Pueblo, Colorado | `EXONERATED` | Murder |
| 37 | **George Stinney** | Mar 23, 1944 | Alcolu, South Carolina | `EXONERATED` | Murder |
| 38 | **Lena Baker** | April 30, 1944 | Cuthbert, Georgia | `EXONERATED` | Murder |
| 39 | **Charles McVay** | July 30, 1945 | Pacific Ocean | `EXONERATED` | Other |
| 40 | **William Heirens** | December 10, 1945 - January 7, 1946 | Chicago, Illinois | `CONVICTED` | Murder |
| 41 | **Ernest Thomas** | July 16, 1949 | Florida | `EXONERATED` | Sexual Assault |
| 42 | **Charles Greenlee** | July 16, 1949 | Florida | `EXONERATED` | Sexual Assault |
| 43 | **Samuel Shepherd** | July 16, 1949 | Florida | `EXONERATED` | Sexual Assault |
| 44 | **Walter Irvin** | July 16, 1949 | Florida | `EXONERATED` | Sexual Assault |
| 45 | **Mack Ingram** | Jun 4, 1951 | Yanceyville, North Carolina | `EXONERATED` | Sexual Assault |
| 48 | **James Thompson** | Oct 1958 | Monroe, North Carolina | `EXONERATED` | Child Sex Abuse |
| 49 | **David Simpson** | Oct 1958 | Monroe, North Carolina | `EXONERATED` | Child Sex Abuse |
| 57 | **Joe Salvati** | Mar 12, 1965 | Chelsea, Massachusetts | `EXONERATED` | Murder |
| 62 | **Geronimo Pratt** | Dec 18, 1968 | Santa Monica, California | `EXONERATED` | Murder |
| 70 | **Inez García** | March 17, 1974 | Soledad, California | `EXONERATED` | Murder |
| 71 | **Michael Self** | May 15, 1974 | Galveston, Texas | `CONVICTED` | Murder |
| 76 | **Ronnie Bridgeman** | 1975 | Cleveland, Ohio | `EXONERATED` | Murder |
| 83 | **Brian Baldwin** | Mar 14, 1977 | Alabama | `EXECUTED` | Murder |
| 106 | **Claus von Bülow** | Dec 21, 1980 | Newport, Rhode Island | `EXONERATED` | Attempted Murder |
| 107 | **Thomas Thompson** | Summer 1981 | Laguna Beach, California | `CONVICTED` | Murder |
| 126 | **Carlos DeLuna** | Feb 4, 1983 | Corpus Christi, Texas | `EXECUTED` | Murder |
| 130 | **Juan Melendez-Colon** | Sep 13, 1983 | Auburndale, Florida | `EXONERATED` | Murder |
| 135 | **Mary Ann** | 1983 | Jefferson, Texas | `EXONERATED` | Child Sex Abuse |
| 166 | **Kenny Richey** | Jun 30, 1986 | Columbus Grove, Ohio | `CONVICTED` | Murder |
| 176 | **Susie Mowbray** | Sep 1987 | Cameron, Texas | `EXONERATED` | Murder |
| 186 | **Richard Danzinger** | Oct 24, 1988 | Austin, Texas | `EXONERATED` | Murder |
| 188 | **Bob Kelly** | Jan 1989 | Edenton, North Carolina | `UNKNOWN` | Child Sex Abuse |
| 189 | **Betsy Kelly** | Jan 1989 | Edenton, North Carolina | `UNKNOWN` | Child Sex Abuse |
| 202 | **Claude Jones** | Nov 1989 | Texas | `EXECUTED` | Murder |
| 212 | **Michelle Lodzinski** | May 25, 1991 | Sayreville, New Jersey | `EXONERATED` | Murder |
| 222 | **Cameron Willingham** | Dec 23, 1991 | Corsicana, Texas | `EXECUTED` | Murder |
| 230 | **Maleek Jones** | Oct 14, 1992 | New Haven, Connecticut | `EXONERATED` | Murder |
| 235 | **Damien Echols** | May 5, 1993 | West Memphis, Arkansas | `RELEASED_ALFORD_PLEA` | Murder |
| 236 | **Jason Baldwin** | May 5, 1993 | West Memphis, Arkansas | `RELEASED_ALFORD_PLEA` | Murder |
| 237 | **Jesse Misskelley** | May 5, 1993 | West Memphis, Arkansas | `RELEASED_ALFORD_PLEA` | Murder |
| 247 | **Gene Town** | 1995 | Wenatchee, Washington | `UNKNOWN` | Child Sex Abuse |
| 248 | **Cherie Town** | 1995 | Wenatchee, Washington | `UNKNOWN` | Child Sex Abuse |
| 249 | **Selid Holt** | 1995 | Wenatchee, Washington | `UNKNOWN` | Child Sex Abuse |
| 263 | **Cain Storey** | Oct 18, 1996 | Rome, Georgia | `EXONERATED` | Murder |
| 272 | **Julie Harper** | Oct 13, 1997 | Lawrenceville, Illinois | `EXONERATED` | Murder |
| 278 | **Tulia 47** | July 1999 | Tulia, Texas | `EXONERATED` | Other |
| 289 | **Melinda Bronson** | 2002 | Queens, New York | `EXONERATED` | Child Sex Abuse |
| 305 | **Stephanie Spurgeon** | Aug 21, 2008 | Palm Harbor, Florida | `EXONERATED` | Manslaughter |
| 307 | **Melissa Calusinski** | Jan 2009 | Lincolnshire, Illinois | `CONVICTED` | Murder |
| 310 | **Aisha McClinton** | 2010 | Joliet, Illinois | `EXONERATED` | Weapon Possession or Sale |
