# The Innocence Archive: Stories of Wrongfully Convicted Americans 

## Project Overview
The Innocence Archive is a comprehensive database and research initiative focused on documenting, analyzing, and raising awareness about wrongful convictions in the United States. The project combines data collection, research, and web development to create a centralized resource for information about wrongfully convicted individuals, the organizations that support them, and the media coverage of their cases.

## Role of AI in This Project
This project utilizes AI assistance for various tasks including data processing, research, and development. Important notes regarding AI involvement:

### AI Contributions
- Data collection and processing automation
- Research assistance and information gathering
- Code development and documentation
- Project organization and management

### Disclaimers and Limitations
- All AI-generated content requires human verification for accuracy
- Data processed by AI may contain errors and should be validated
- AI analysis represents patterns in data but not legal or professional opinions
- The project maintains human oversight for all critical decisions

### Session Management Guidelines
- Always refer to the master_todo.md file at the beginning of each session
- Pay attention to context limits and save work regularly
- Update all documentation files including README.md and todo lists
- Maintain consistent project organization across sessions
- Document progress and next steps at the end of each session

## Project Structure
The project is organized into several major phases, each focusing on a different aspect of wrongful convictions:

```
wrongful_conviction_project/
├── branding/                      # Brand identity, logos, style guides
├── database/                      # Database schemas and SQL files
├── media_research/                # Phase 1: Media & Journalism Research
│   ├── podcasts/                  # Podcast data collection and processing
│   ├── film/                      # Film and documentary data
│   ├── books/                     # Books and long-form journalism data
│   └── academic/                  # Academic journals and legal publications
├── organizations/                 # Phase 2: Organizations Research
│   ├── innocence_projects/        # Innocence Projects (national and regional)
│   ├── legal_advocacy/            # Legal advocacy organizations
│   ├── post_exoneration_support/  # Post-exoneration support services
│   └── policy_reform/             # Policy reform organizations
├── individuals/                   # Phase 3: Expanded Individuals Research
│   ├── exonerees/                 # Formally exonerated individuals
│   ├── pardoned/                  # Pardoned individuals
│   ├── active_cases/              # Cases in various stages of legal review
│   └── contributing_factors/      # Research on contributing factors
├── website_models/                # Website concept models and visualization components
│   ├── frontend/                  # HTML, CSS, JavaScript files (models)
│   ├── backend/                   # API and server components (models)
│   └── visualizations/            # Data visualization tools (models)
├── project/                       # Main Project Application Code
│   ├── client/                    # React frontend application
│   └── server/                    # PostgreSQL backend server
└── community/                     # Community engagement components
    ├── submission_system/         # Forms for new information
    ├── newsletter/                # Update system
    └── partnerships/              # Organization partnerships
```

## Project Phases

### Phase 1: Media & Journalism Research
This phase focuses on compiling and analyzing media coverage of wrongful convictions, including:
- Podcasts (Serial, Undisclosed, In the Dark, Wrongful Conviction with Jason Flom, etc.)
- Documentaries & Film (The Innocence Files, Making a Murderer, etc.)
- Books and long-form journalism
- Academic journals and legal publications

**Current status:** Ongoing. Books research complete. Film research mostly complete (pending verification). Academic and Podcast preliminary research complete.

#### Podcast Transcribing & Summarizing
A key component of Phase 1 involves processing podcast audio content:
- Download MP3s of all available podcasts
- Transcribe using Whisper AI
- Summarize using template and Gemini

**Current Status:** Wrongful Conviction podcasts currently being downloaded and transcribed.

### Phase 2: Organizations Research
This phase involves researching organizations working on wrongful convictions:
- Innocence Projects (national and regional)
- Legal advocacy organizations
- Post-exoneration support services
- Policy reform organizations
- University-based clinics and programs

**Current Status:** Some organizational research has been completed and should be reviewed, and then decisions made about what still needs researching here.

### Phase 3: Expanded Wrongfully Convicted Individuals Research
This phase broadens the scope beyond formally exonerated individuals:
- Individuals identified by credible organizations as wrongfully convicted
- Cases with strong evidence of innocence but without formal exoneration
- Cases in various stages of legal review or appeal
- Classification system for strength of innocence claims
- In-depth research on contributing factors

**Current Status:** Not yet started. Remember to review previous work as the initial organization of exonerated individuals comprised a large amount of work and most research and database schema has been based on this work up to this point.

### Phase 4: Database and Website Enhancement
This phase focuses on improving the database and website functionality:
- Updating database schema to accommodate new data
- Improving search and filtering capabilities
- Developing new visualization features
- Creating an API for researchers and journalists

**Current Status:** Basic implementation completed; enhancements pending.

### Phase 5: Community Engagement
This phase develops systems for community involvement:
- Submission system for new information
- Newsletter or update system
- Partnerships with key organizations

**Current Status:** Not yet started.

## Current Focus
- Completing Phase 1: Media & Journalism Research
  - Finish Film research list, decide on detail level of academic research
  - Continue Podcast Transcribing & Summarizing efforts.
  - Cross-referencing media content with existing database entries

- Beginning Phase 2: Organizations Research
  - Incorporate the notes in the current status above.

## Project Resources
- Media sources data: `/media_research/media_sources.md`
- Film data: `/media_research/film.md`
- Books data: `/media_research/books.md`
- Podcast processing: `/media_research/podcasts/` - Database schema: `/database/schema.sql`
- Database schema update: `/database/schema_update.sql`


## Dependencies
- Python 3.6+ (for data processing/scraping/AI tasks)
- Node.js/npm (for React client)
- PostgreSQL (for backend database)
- Web framework (e.g., Express for Node.js server)
- Data visualization libraries
- Whisper AI (for transcription)
- Access to Gemini API (for summarization)

## Contributing
Contributions are welcome! Please see the contributing guidelines for more information.

## License
This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments
- The Innocence Project and affiliated organizations
- Journalists and podcasters covering wrongful convictions
- Researchers and legal professionals in the field
- The wrongfully convicted individuals whose stories drive this work
