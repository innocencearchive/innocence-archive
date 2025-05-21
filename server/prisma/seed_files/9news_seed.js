const { PrismaClient, IndividualStatus } = require('@prisma/client');
const fs = require('fs');
const { parse } = require('csv-parse'); // npm install csv-parse

const prisma = new PrismaClient();

// Array to store log entries
const logEntries = [];

/**
 * Adds a log entry to the global logEntries array.
 */
function addLogEntry(level, action, message, details = '') {
  const timestamp = new Date().toISOString();
  logEntries.push({
    timestamp,
    level,
    action,
    message,
    details: typeof details === 'object' ? JSON.stringify(details) : details,
  });
  if (level === 'ERROR' || level === 'WARN') {
    console.warn(`[${timestamp}] ${level} - ${action}: ${message}`, details || '');
  } else {
    console.log(`[${timestamp}] ${level} - ${action}: ${message}`, details || '');
  }
}

const COMMON_SUFFIXES = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'V', 'M.D.', 'Ph.D.', 'Esq.'];
const normalizeSuffixForComparison = (sfx) => sfx.toUpperCase().replace(/[.,]/g, '');

/**
 * Parses a full name string into an object with firstName, middleName, lastName, suffix, and nickname.
 */
function parseFullName(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: null, middleName: null, lastName: null, suffix: null, nickname: null };
  }

  let parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) {
    return { firstName: null, middleName: null, lastName: null, suffix: null, nickname: null };
  }

  let firstName = null;
  let lastName = null;
  let suffix = null;
  let nickname = null;
  const middleNameComponents = [];

  if (parts.length > 0) {
    const lastWordFromCSV = parts[parts.length - 1];
    const normalizedLastWordFromCSV = normalizeSuffixForComparison(lastWordFromCSV);
    const matchedCanonicalSuffix = COMMON_SUFFIXES.find(cs => normalizeSuffixForComparison(cs) === normalizedLastWordFromCSV);
    if (matchedCanonicalSuffix) {
      suffix = matchedCanonicalSuffix;
      parts.pop();
    }
  }

  if (parts.length > 0) {
    firstName = parts.shift();
  } else {
    return { firstName: null, middleName: null, lastName: null, suffix: suffix, nickname: null };
  }

  if (parts.length > 0) {
    lastName = parts.pop();
  }

  const remainingParts = parts;
  let potentialNicknameParts = [];
  let inNickname = false;
  for (let i = 0; i < remainingParts.length; i++) {
    const part = remainingParts[i];
    if ((part.startsWith("'") && part.endsWith("'")) || (part.startsWith('"') && part.endsWith('"'))) {
      if (!nickname) nickname = part.substring(1, part.length - 1);
      else middleNameComponents.push(part);
    } else if (part.startsWith("'") || part.startsWith('"')) {
      if (!inNickname) {
        inNickname = true;
        potentialNicknameParts.push(part.substring(1));
      } else middleNameComponents.push(part);
    } else if ((part.endsWith("'") || part.endsWith('"')) && inNickname) {
      potentialNicknameParts.push(part.substring(0, part.length - 1));
      if (!nickname) nickname = potentialNicknameParts.join(' ');
      potentialNicknameParts = [];
      inNickname = false;
    } else if (inNickname) {
      potentialNicknameParts.push(part);
    } else {
      middleNameComponents.push(part);
    }
  }
  if (inNickname && potentialNicknameParts.length > 0) {
    middleNameComponents.push(...potentialNicknameParts.map(p => `"${p}"`));
  }

  return {
    firstName: firstName || null,
    middleName: middleNameComponents.length > 0 ? middleNameComponents.join(' ') : null,
    lastName: lastName || null,
    suffix: suffix || null,
    nickname: nickname || null,
  };
}

/**
 * Converts an array of log entry objects to a CSV string.
 */
function convertLogToCSV(entries) {
  if (!entries || entries.length === 0) return '';
  const header = Object.keys(entries[0]).join(',');
  const rows = entries.map(entry =>
    Object.values(entry).map(value => {
      const stringValue = String(value === null || value === undefined ? '' : value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',')
  );
  return [header, ...rows].join('\n');
}

async function main() {
  addLogEntry('INFO', 'SCRIPT_START', 'Start seeding Innocence Project news links (with headline, improved suffix, case-insensitive, nickname parsing)...');

  let innocenceProjectSource;
  try {
    innocenceProjectSource = await prisma.informationSource.upsert({
      where: { name: "The Innocence Project" },
      update: { baseUrl: "https://innocenceproject.org/" },
      create: { name: "The Innocence Project", baseUrl: "https://innocenceproject.org/" },
    });
    addLogEntry('INFO', 'UPSERT_SOURCE', `Ensured "The Innocence Project" InformationSource exists.`, { id: innocenceProjectSource.id });
  } catch (sourceError) {
    addLogEntry('ERROR', 'UPSERT_SOURCE', `Failed to upsert "The Innocence Project" InformationSource.`, { error: sourceError.message, stack: sourceError.stack });
    console.error("Critical error: Could not establish InformationSource. Terminating.");
    return;
  }

  const filePath = './innocenceproject_news_processed.csv'; // Ensure this is your preprocessed CSV
  let fileContent;
  try {
    fileContent = fs.readFileSync(filePath, { encoding: 'utf-8' });
    addLogEntry('INFO', 'READ_CSV_FILE', `Successfully read CSV file: ${filePath}`);
  } catch (readError) {
    addLogEntry('ERROR', 'READ_CSV_FILE', `Failed to read CSV file: ${filePath}`, { error: readError.message, stack: readError.stack });
    return;
  }

  await new Promise((resolve, reject) => {
    parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    }, async (err, records) => {
      if (err) {
        addLogEntry('ERROR', 'PARSE_CSV_CONTENT', 'Failed to parse CSV content.', { error: err.message });
        reject(err);
        return;
      }
      addLogEntry('INFO', 'PARSE_CSV_CONTENT', `Successfully parsed ${records.length} records from CSV.`);

      for (const record of records) {
        const csvFullName = record['name'];
        const csvUrl = record['link'];
        const csvHeadline = record['headline']; // <-- Read the headline
        const csvStatus = record['status'] ? record['status'].toLowerCase() : null;

        const recordIdentifier = `CSV_Name: "${csvFullName}", Link: "${csvUrl}", Headline: "${csvHeadline}", Status: "${csvStatus}"`;

        if (!csvFullName || !csvUrl) {
          addLogEntry('WARN', 'SKIP_RECORD', `Skipping record due to missing Name or Link.`, { originalRecord: record, recordIdentifier });
          continue;
        }
        // Headline can be optional, so we don't skip if it's missing, just won't populate it.

        const parsedName = parseFullName(csvFullName);
        addLogEntry('INFO', 'PARSE_NAME', `Parsed name for record.`, { csvFullName, parsedName, recordIdentifier });

        if (!parsedName.firstName) {
          addLogEntry('WARN', 'SKIP_RECORD', `Could not reliably parse first name. Skipping.`, { csvFullName, parsedName, recordIdentifier });
          continue;
        }

        try {
          const queryConditions = {};
          queryConditions.firstName = parsedName.firstName ? { equals: parsedName.firstName, mode: 'insensitive' } : null;
          queryConditions.lastName = parsedName.lastName ? { equals: parsedName.lastName, mode: 'insensitive' } : null;
          queryConditions.middleName = parsedName.middleName ? { equals: parsedName.middleName, mode: 'insensitive' } : null;
          queryConditions.suffix = parsedName.suffix ? { equals: parsedName.suffix, mode: 'insensitive' } : null;


          addLogEntry('INFO', 'FIND_INDIVIDUAL_ATTEMPT', `Attempting to find individual.`, { queryConditions, recordIdentifier });
          const potentialIndividuals = await prisma.individual.findMany({ where: queryConditions });

          let individualToLink = null;

          if (potentialIndividuals.length === 1) {
            individualToLink = potentialIndividuals[0];
            addLogEntry('INFO', 'FIND_INDIVIDUAL_SUCCESS', `Found unique existing Individual.`, { individualId: individualToLink.id, csvFullName, recordIdentifier });
          } else if (potentialIndividuals.length > 1) {
            addLogEntry('WARN', 'FIND_INDIVIDUAL_MULTIPLE', `Multiple Individuals found. Skipping.`, { count: potentialIndividuals.length, ids: potentialIndividuals.map(p => p.id), parsedName, recordIdentifier });
          } else { // No individuals found
            if (csvStatus === 'new') {
              addLogEntry('INFO', 'CREATE_INDIVIDUAL_ATTEMPT', `No existing individual found for "${csvFullName}", status is 'new'. Attempting to create.`, { parsedName, recordIdentifier });
              try {
                individualToLink = await prisma.individual.create({
                  data: {
                    firstName: parsedName.firstName,
                    middleName: parsedName.middleName,
                    lastName: parsedName.lastName,
                    suffix: parsedName.suffix,
                    nickname: parsedName.nickname,
                    status: IndividualStatus.UNKNOWN,
                    disambiguationTag: null,
                    aiGenerated: false,
                  },
                });
                addLogEntry('INFO', 'CREATE_INDIVIDUAL_SUCCESS', `Successfully created new Individual.`, { individualId: individualToLink.id, name: csvFullName, recordIdentifier });
              } catch (createError) {
                addLogEntry('ERROR', 'CREATE_INDIVIDUAL_FAILURE', `Failed to create new Individual for "${csvFullName}".`, { error: createError.message, stack: createError.stack, parsedName, recordIdentifier });
                const justCreated = await prisma.individual.findFirst({ where: queryConditions });
                if (justCreated) {
                  individualToLink = justCreated;
                  addLogEntry('INFO', 'FIND_INDIVIDUAL_RECOVERY', `Found individual after create attempt failed.`, { individualId: individualToLink.id });
                }
              }
            } else {
              addLogEntry('WARN', 'FIND_INDIVIDUAL_NONE', `No Individual found and status is not 'new'. Skipping.`, { parsedName, recordIdentifier });
            }
          }

          if (individualToLink) {
            try {
              // Data for creating or updating the link
              const linkData = {
                individualId: individualToLink.id,
                informationSourceId: innocenceProjectSource.id,
                specificUrl: csvUrl,
                headline: csvHeadline || null, // <-- Add headline here, use null if csvHeadline is empty/undefined
              };

              const newLink = await prisma.individualSourceLink.upsert({
                where: {
                  individualId_specificUrl: {
                    individualId: individualToLink.id,
                    specificUrl: csvUrl,
                  }
                },
                create: linkData,
                update: { // Fields to update if the link already exists
                  informationSourceId: innocenceProjectSource.id, // Ensure source is correct
                  headline: csvHeadline || null, // Update headline
                  // description: ... // if you want to update description too
                }
              });
              addLogEntry('INFO', 'UPSERT_LINK_SUCCESS', `Upserted IndividualSourceLink.`, { linkId: newLink.id, individualId: individualToLink.id, url: csvUrl, headline: csvHeadline, recordIdentifier });
            } catch (linkError) {
              addLogEntry('ERROR', 'UPSERT_LINK_FAILURE', `Error upserting IndividualSourceLink.`, { individualId: individualToLink.id, url: csvUrl, error: linkError.message, stack: linkError.stack, recordIdentifier });
            }
          }
        } catch (e) {
          addLogEntry('ERROR', 'PROCESS_RECORD_FAILURE', `Error processing CSV record.`, { error: e.message, stack: e.stack, recordIdentifier });
        }
      }
      addLogEntry('INFO', 'PROCESS_RECORDS_COMPLETE', 'Finished processing all CSV records.');
      resolve();
    });
  });
}

main()
  .catch(async (e) => {
    addLogEntry('ERROR', 'MAIN_EXECUTION_FAILURE', 'Critical error in main execution.', { error: e.message, stack: e.stack });
  })
  .finally(async () => {
    addLogEntry('INFO', 'SCRIPT_END', 'Seeding script finished execution.');
    try {
      const csvLogData = convertLogToCSV(logEntries);
      const logFilePath = './innocence_project_news_seed_log.csv';
      fs.writeFileSync(logFilePath, csvLogData);
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] INFO - SCRIPT_LOG_WRITE: Log data written to ${logFilePath}`);
    } catch (logWriteError) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] ERROR - SCRIPT_LOG_WRITE: Failed to write log file.`, { error: logWriteError.message, stack: logWriteError.stack });
    }
    await prisma.$disconnect();
  });
