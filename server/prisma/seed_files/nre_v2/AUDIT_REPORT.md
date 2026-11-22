# National Registry of Exonerations (NRE) Audit & Ingest Report (`nre_v2`)

Generated: 2026-11-22T20:54:40.071Z

## Summary Metrics
- **Raw NRE CSV rows:** 4123
- **Deduplicated Unique Individuals in Bundle:** 4084
- **Repeat Exonerees Consolidated (1 Individual with 2–3 NRE links):** 36 individuals (saved 39 duplicate rows)
- **Total NRE Source Links Attached:** 4123
- **Distinct Same-Name Individuals Auto-Disambiguated:** 7
- **Unmapped Crime Categories:** 0 (45/45 exact canonical matches)
- **Blank-State Pre-1989 Rows Flagged:** 51
- **Live DB Overlap (will auto-MERGE safely):** 106 of 176 existing Individuals
- **Live DB Same-Name Different-Person Collisions Prevented:** 5
- **Live DB vs NRE Year Differences (mostly crime year vs conviction year, or pardon vs vacatur):** 28
- **Wikipedia Cross-Check (`wrongful_convictions_summarized.csv`, 340 rows):** 256 matched in NRE, 81 Wikipedia-only (historical/pre-NRE/non-exonerated), 5 major year anomalies

## 1. Repeat Exonerees Consolidated Into 1 Individual With Multiple NRE Cases
| Individual | State | Cases | NRE Case Links Attached |
| --- | --- | --- | --- |
| **Angelo Shenault Jr.** | Illinois | 2 | #12526 (Drug Possession or Sale, 2006→2018); #12527 (Drug Possession or Sale, 2008→2018) |
| **Anthony Hart** | Michigan | 2 | #12413 (Sex Offender Registration, 2013→2015); #12414 (Sex Offender Registration, 2014→2015) |
| **Anthony Mays** | Illinois | 3 | #13182 (Drug Possession or Sale, 2003→2022); #13277 (Drug Possession or Sale, 2004→2022); #12774 (Drug Possession or Sale, 2006→2020) |
| **Anthony Wright Jr.** | Illinois | 2 | #13298 (Drug Possession or Sale, 2005→2022); #13204 (Drug Possession or Sale, 2007→2022) |
| **Bryant Patrick** | Illinois | 2 | #12991 (Drug Possession or Sale, 2005→2021); #12961 (Drug Possession or Sale, 2007→2020) |
| **Carlos Perez** | New York | 2 | #11248 (Murder, 1997→2012); #11268 (Murder, 1997→2013) |
| **Christopher Williams** | Pennsylvania | 2 | #12979 (Murder, 1992→2021); #12758 (Murder, 1993→2019) |
| **Cordero Payne** | Illinois | 2 | #13496 (Drug Possession or Sale, 2005→2022); #12595 (Drug Possession or Sale, 2006→2019) |
| **Craig Armstrong** | Illinois | 2 | #12703 (Sex Offender Registration, 2005→2018); #12704 (Sex Offender Registration, 2012→2016) |
| **Dana Holland** | Illinois | 2 | #10532 (Attempted Murder, 1995→2003); #10531 (Sexual Assault, 1997→2003) |
| **Darryl Hunt** | North Carolina | 2 | #10544 (Murder, 1985→2004); #13640 (Murder, 1987→1990) |
| **DeJuan Jordan** | Texas | 2 | #12587 (Sex Offender Registration, 2015→2019); #12588 (Sex Offender Registration, 2016→2019) |
| **Devon Ayers** | New York | 2 | #11246 (Murder, 1997→2012); #11266 (Murder, 1997→2013) |
| **Dexter Willis** | Illinois | 2 | #13415 (Drug Possession or Sale, 2003→2022); #13307 (Drug Possession or Sale, 2004→2022) |
| **Frederick Jeffery** | Texas | 2 | #13551 (Drug Possession or Sale, 2010→2013); #13450 (Drug Possession or Sale, 2018→2022) |
| **George Almond** | Illinois | 2 | #12537 (Drug Possession or Sale, 2006→2018); #13113 (Drug Possession or Sale, 2008→2021) |
| **Gregory Dobbins** | Illinois | 2 | #12610 (Drug Possession or Sale, 2004→2019); #13244 (Drug Possession or Sale, 2009→2022) |
| **Guy Shiflett Jr.** | Texas | 2 | #12817 (Sex Offender Registration, 2014→2020); #12572 (Sex Offender Registration, 2016→2018) |
| **Henry Thomas** | Illinois | 2 | #12517 (Drug Possession or Sale, 2003→2017); #12602 (Drug Possession or Sale, 2007→2019) |
| **James Dixon** | Illinois | 2 | #4687 (Murder, 1972→1974); #4688 (Assault, 1976→1976) |
| **James Hill** | Indiana | 2 | #11477 (Sexual Assault, 1982→2009); #13300 (Murder, 2018→2022) |
| **Jean Cantave** | New York | 2 | #13123 (Sexual Assault, 2008→2012); #13122 (Assault, 2009→2014) |
| **Jermaine Coleman** | Illinois | 2 | #13166 (Drug Possession or Sale, 2004→2022); #12601 (Drug Possession or Sale, 2006→2019) |
| **Jermaine Morris** | Illinois | 3 | #13283 (Drug Possession or Sale, 2004→2022); #12962 (Drug Possession or Sale, 2005→2020); #12990 (Drug Possession or Sale, 2006→2021) |
| **Jerry Townsend** | Florida | 2 | #10914 (Murder, 1980→2001); #13731 (Murder, 1982→2001) |
| **John Thompson** | Louisiana | 2 | #10901 (Murder, 1985→2003); #10902 (Robbery, 1985→1999) |
| **Michael Conley** | Illinois | 2 | #13158 (Drug Possession or Sale, 2004→2022); #13242 (Drug Possession or Sale, 2007→2022) |
| **Michael Cosme** | New York | 2 | #11247 (Murder, 1997→2012); #11267 (Murder, 1997→2013) |
| **Michael Pardue** | Alabama | 3 | #10747 (Murder, 1973→1997); #13564 (Murder, 1973→1995); #13565 (Murder, 1973→1997) |
| **Michael Wheeler** | Washington | 2 | #12178 (Sex Offender Registration, 2000→2015); #12179 (Sex Offender Registration, 2011→2013) |
| **Owen Cesar** | Pennsylvania | 2 | #11374 (Child Sex Abuse, 2004→2009); #11373 (Child Sex Abuse, 2005→2011) |
| **Queen Esther Jordan** | Texas | 2 | #11568 (Drug Possession or Sale, 2008→2009); #11741 (Drug Possession or Sale, 2009→2009) |
| **Richard Phillips** | Michigan | 2 | #13413 (Robbery, 1971→2022); #12399 (Murder, 1972→2018) |
| **Robert Henderson** | New Jersey | 2 | #13371 (Drug Possession or Sale, 2007→2009); #13372 (Drug Possession or Sale, 2009→2010) |
| **Ryun Wahlgren** | Texas | 2 | #12309 (Sex Offender Registration, 2015→2017); #12310 (Sex Offender Registration, 2015→2017) |
| **Shaun James** | Illinois | 2 | #12522 (Drug Possession or Sale, 2004→2017); #12959 (Drug Possession or Sale, 2009→2020) |

## 2. Same-Name Distinct-Person Collisions Prevented Against Live DB
| NRE Record (kept separate) | Existing Live DB Record |
| --- | --- |
| John Brown (Arkansas, 1992→2020, tag="Arkansas, 1992") | #169 John Brown (Louisiana, 1977→?) |
| James Richardson (West Virginia, 1989→1999, tag="") | #182 James Richardson (Florida, 1968→1989) |
| Christopher Scott (Illinois, 2006→2017, tag="Illinois, 2006") | #46 Christopher Scott (Texas, 1997→2009) |
| Tammy Vance (Mississippi, 2001→2013, tag="Mississippi, 2001") | #10 Tammy Vance (West Virginia, ?→?) |
| Anthony Wright (Illinois, 2005→2022, tag="") | #119 Anthony Wright (Pennsylvania, 1993→2016) |

## 3. Live DB (Books/Films) vs NRE Year Discrepancies (Review List)
> Note: `MERGE` preserves existing live DB values and attaches the NRE source link. Most differences below occur because Books/Films recorded the **crime/arrest year** (vs NRE's **conviction year**) or **pardon/release year** (vs NRE's **official dismissal/exoneration year**).

| Individual | State | DB Conv | NRE Conv | DB Exon | NRE Exon | NRE Link |
| --- | --- | --- | --- | --- | --- | --- |
| **Brian Banks (DB #132)** | California | 2002 | 2003 | 2012 | 2012 | https://exonerationregistry.org/cases/11096 |
| **Clarence Brandley (DB #26)** | Texas | 1980 | 1981 | — | 1990 | https://exonerationregistry.org/cases/10280 |
| **Steven Chaney (DB #3)** | Texas | 1987 | 1987 | 2018 | 2019 | https://exonerationregistry.org/cases/12584 |
| **Kerry Cook (DB #44)** | Texas | 1977 | 1978 | — | 2024 | https://exonerationregistry.org/cases/13759 |
| **Joseph Dick (DB #143)** | Virginia | 1998 | 1999 | 2017 | 2016 | https://exonerationregistry.org/cases/12160 |
| **Roosevelt Glenn (DB #118)** | Indiana | 1991 | 1993 | 2009 | 2017 | https://exonerationregistry.org/cases/12192 |
| **Eric Glisson (DB #69)** | New York | 1995 | 1997 | 2013 | 2012 | https://exonerationregistry.org/cases/11245 |
| **Michael Graham (DB #75)** | Louisiana | 1987 | 1987 | 2001 | 2000 | https://exonerationregistry.org/cases/10483 |
| **Keith Harward (DB #2)** | Virginia | 1982 | 1983 | 2016 | 2016 | https://exonerationregistry.org/cases/11980 |
| **Olmedo Hidalgo (DB #68)** | New York | 1990 | 1992 | 2005 | 2005 | https://exonerationregistry.org/cases/10526 |
| **Johnny Hincapie (DB #1)** | New York | 1991 | 1991 | 2015 | 2017 | https://exonerationregistry.org/cases/12199 |
| **James Kluppelberg (DB #94)** | Illinois | 1984 | 1989 | 2012 | 2012 | https://exonerationregistry.org/cases/11103 |
| **David Lemus (DB #67)** | New York | 1990 | 1992 | 2005 | 2007 | https://exonerationregistry.org/cases/10610 |
| **Alton Logan (DB #84)** | Illinois | 1983 | 1982 | 2008 | 2008 | https://exonerationregistry.org/cases/10619 |
| **Timothy Masters (DB #48)** | Colorado | 1999 | 1999 | 2011 | 2008 | https://exonerationregistry.org/cases/10641 |
| **Kristie Mayhugh (DB #159)** | Texas | 1997 | 1998 | 2016 | 2016 | https://exonerationregistry.org/cases/12154 |
| **Vincent Moto (DB #127)** | Pennsylvania | 1982 | 1987 | 2004 | 1996 | https://exonerationregistry.org/cases/10719 |
| **Anthony Porter (DB #139)** | Illinois | — | 1983 | 2003 | 1999 | https://exonerationregistry.org/cases/10767 |
| **Elizabeth Ramirez (DB #157)** | Texas | 1997 | 1998 | 2016 | 2016 | https://exonerationregistry.org/cases/12153 |
| **Cassandra Rivera (DB #158)** | Texas | 1997 | 1998 | 2016 | 2016 | https://exonerationregistry.org/cases/12155 |
| **Jacques Rivera (DB #93)** | Illinois | 1988 | 1990 | 2011 | 2011 | https://exonerationregistry.org/cases/11015 |
| **Juan Rivera (DB #82)** | Illinois | 1993 | 1993 | 2011 | 2012 | https://exonerationregistry.org/cases/11049 |
| **Richard Rosario (DB #70)** | New York | 1996 | 1998 | 2016 | 2016 | https://exonerationregistry.org/cases/12136 |
| **Derek Tice (DB #31)** | Virginia | 1997 | 2000 | 2017 | 2011 | https://exonerationregistry.org/cases/11019 |
| **Anna Vasquez (DB #160)** | Texas | 1997 | 1998 | 2016 | 2016 | https://exonerationregistry.org/cases/12156 |
| **Jon-Adrian Velazquez (DB #66)** | New York | 1998 | 2000 | 2024 | 2024 | https://exonerationregistry.org/cases/13818 |
| **Danial Williams (DB #28)** | Virginia | 1997 | 1999 | 2017 | 2016 | https://exonerationregistry.org/cases/12159 |
| **Eric Wilson (DB #30)** | Virginia | 1997 | 1999 | 2017 | 2017 | https://exonerationregistry.org/cases/12215 |

## 4. Wikipedia vs NRE Major Year Anomalies (Pre-Audit for Future Wiki Import)
| Name | Wiki Location | NRE State | Wiki Crime Year | NRE Conv Year | NRE Exon Year |
| --- | --- | --- | --- | --- | --- |
| **Jack McCullough** | Sycamore, Illinois | Illinois | 1957 | 2012 | 2016 |
| **Dennis Perry** | Camden County, Georgia | Georgia | 1985 | 2003 | 2021 |
| **Margaret Earle** | Plymouth, Massachusetts | Massachusetts | 1985 | 2005 | 2010 |
| **James Chad-Lewis Clay** | Detroit, Michigan | Michigan | 1997 | 2017 | 2019 |
| **Brenda Jones** | Friendship, Wisconsin | Wisconsin | 2017 | 2016 | 2018 |

## 5. Blank-State Pre-1989 NRE Rows (51 rows)
> All 51 rows below have a blank `State` cell in the original Pre-1989 NRE export (none are from 1988 or later). They import cleanly with `caseLocationState: null` and can be enriched later.

| Name | Conv | Exon | Crime | NRE URL |
| --- | --- | --- | --- | --- |
| Craig Bell | 1987 | 1987 | Murder | https://exonerationregistry.org/cases/4664 |
| Riley Brooks | 1966 | 1973 | Murder | https://exonerationregistry.org/cases/4711 |
| Willie Comer | 1961 | 1962 | Robbery | https://exonerationregistry.org/cases/4358 |
| Myles Connor Jr. | 1981 | 1985 | Murder | https://exonerationregistry.org/cases/4359 |
| C.D. Cooper | 1921 | 1934 | Murder | https://exonerationregistry.org/cases/4361 |
| Alvin Craig | 1929 | 1930 | Murder | https://exonerationregistry.org/cases/4363 |
| Frank Dove | 1922 | 1928 | Murder | https://exonerationregistry.org/cases/4374 |
| Fred Dove | 1922 | 1928 | Murder | https://exonerationregistry.org/cases/4375 |
| Ayliff Draper | 1935 | 1938 | Murder | https://exonerationregistry.org/cases/4376 |
| Roy Eaton | 1940 | 1956 | Robbery | https://exonerationregistry.org/cases/4380 |
| Arthur Emery | 1953 | 1954 | Robbery | https://exonerationregistry.org/cases/4382 |
| Will Evans | 1912 | 1932 | Sexual Assault | https://exonerationregistry.org/cases/4386 |
| Jack Favor | 1967 | 1974 | Murder | https://exonerationregistry.org/cases/4387 |
| Walter Hess | 1929 | 1930 | Murder | https://exonerationregistry.org/cases/4438 |
| Joseph Johnson | 1962 | 1968 | Sexual Assault | https://exonerationregistry.org/cases/4459 |
| Hayden Jones | 1949 | 1968 | Child Sex Abuse | https://exonerationregistry.org/cases/4463 |
| Tom Jones | 1935 | 1938 | Murder | https://exonerationregistry.org/cases/4461 |
| Hamp Kendall | 1907 | 1917 | Murder | https://exonerationregistry.org/cases/4469 |
| Michael Linder | 1979 | 1981 | Murder | https://exonerationregistry.org/cases/4491 |
| John Loftus | 1886 | 1888 | Robbery | https://exonerationregistry.org/cases/4493 |
| Jesse Lucas | 1909 | 1941 | Murder | https://exonerationregistry.org/cases/4496 |
| Margaret Lucas | 1909 | 1941 | Murder | https://exonerationregistry.org/cases/4497 |
| Calvin Lyons | 1980 | 1984 | Robbery | https://exonerationregistry.org/cases/4499 |
| Ernest Lyons | 1909 | 1912 | Murder | https://exonerationregistry.org/cases/4498 |
| Guy Gordon Marsh | 1973 | 1987 | Murder | https://exonerationregistry.org/cases/4508 |
| Lloyd Eldon Miller | 1956 | 1971 | Murder | https://exonerationregistry.org/cases/4525 |
| James Montgomery | 1924 | 1949 | Sexual Assault | https://exonerationregistry.org/cases/4526 |
| Olen Montgomery | 1931 | 1937 | Sexual Assault | https://exonerationregistry.org/cases/4527 |
| Clarence Norris | 1931 | 1976 | Sexual Assault | https://exonerationregistry.org/cases/4532 |
| Anthony Piano | 1937 | 1937 | Robbery | https://exonerationregistry.org/cases/4547 |
| Ozie Powell | 1931 | 1937 | Sexual Assault | https://exonerationregistry.org/cases/4551 |
| Antonio Rivera | 1975 | 1975 | Murder | https://exonerationregistry.org/cases/4567 |
| Willie Roberson | 1931 | 1937 | Sexual Assault | https://exonerationregistry.org/cases/4569 |
| Santos Rodriguez | 1954 | 1957 | Murder | https://exonerationregistry.org/cases/4572 |
| Silas Rogers | 1943 | 1952 | Murder | https://exonerationregistry.org/cases/4573 |
| Johnny Ross | 1975 | 1981 | Sexual Assault | https://exonerationregistry.org/cases/4575 |
| George Rusnak | 1891 | 1897 | Murder | https://exonerationregistry.org/cases/4579 |
| Michael Sabol | 1891 | 1895 | Murder | https://exonerationregistry.org/cases/4581 |
| Lonnie Sawyer | 1975 | 1977 | Kidnapping | https://exonerationregistry.org/cases/4583 |
| Sandy Sawyer | 1975 | 1977 | Kidnapping | https://exonerationregistry.org/cases/4584 |
| Ronnie Starks | 1982 | 1985 | Robbery | https://exonerationregistry.org/cases/4603 |
| Steve Titus | 1981 | 1981 | Sexual Assault | https://exonerationregistry.org/cases/4623 |
| Andrew Toth | 1891 | 1911 | Murder | https://exonerationregistry.org/cases/4626 |
| John Vickers | 1907 | 1917 | Murder | https://exonerationregistry.org/cases/4636 |
| Bernard Vindiola | 1977 | 1979 | Murder | https://exonerationregistry.org/cases/4637 |
| Merla Walpole | 1975 | 1975 | Murder | https://exonerationregistry.org/cases/4643 |
| William Wellmon | 1942 | 1943 | Sexual Assault | https://exonerationregistry.org/cases/4647 |
| Eugene Williams | 1931 | 1937 | Sexual Assault | https://exonerationregistry.org/cases/4651 |
| George Williams | 1922 | 1928 | Murder | https://exonerationregistry.org/cases/4652 |
| James Willis | 1927 | 1927 | Robbery | https://exonerationregistry.org/cases/4653 |
| William Wilson | 1915 | 1918 | Murder | https://exonerationregistry.org/cases/4654 |
