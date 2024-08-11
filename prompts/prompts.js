/* eslint-disable no-undef */
let PROMPTS = [
    {
      name: "Better Titles ENG",
      description: "Generate better titles for Titles and Company Names",
      id: "eng_better_titles",
      path: "../prompts/prompt-EN-titles.txt",
      engine: "gpt-3.5-turbo",
      required_parameters: ["title", "company_name"],
    },
    {
      name: "Basic Enrichment ENG",
      description: "Generate basic enrichment based on company website",
      id: "eng_basic_enrichment",
      path: "../prompts/systemPrompt-basic.txt",
      engine: "gpt-3.5-turbo",
      required_parameters: ["website"],
    },
    {
      name: "Basic Enrichment SE",
      description: "Generate basic enrichment based on company website",
      id: "se_basic_enrichment",
      path: "../prompts/systemPrompt-basic-SE.txt",
      engine: "gpt-3.5-turbo",
      required_parameters: ["website"],
      enriched_fields: ["value_proposition", "comment_on_content_piece"],
    },
    {
      name: "Valid Website URL",
      description: "Generate valid url based on website link",
      id: "url_valid_website",
      path: "../prompts/prompt-website-url.txt",
      engine: "gpt-3.5-turbo",
      required_parameters: ["website"],
    },
  ];
  
  module.exports = { PROMPTS };
  