# Gemini UPDATE Action Configuration Guide

## Problem Description

When you configure a Gemini action with operation type **UPDATE** and field mappings, the system expects Gemini to return a JSON response that matches your field mapping configuration. If the parsing fails or the response keys don't match, no proposed changes are created, and the "Apply Changes" button doesn't appear.

## What Was Fixed

### 1. **Enhanced Logging** (`ai-action-executor.service.ts`)
Added detailed logging to help diagnose field mapping issues:
- Logs when JSON parsing succeeds or fails
- Logs each field mapping attempt (success/failure)
- Shows which keys were found/not found in the Gemini response
- Displays available keys when no fields are mapped

### 2. **Automatic JSON Instruction** (`ai-action-executor.service.ts`)
When an action has UPDATE/CREATE operation type with field mappings, the system now automatically appends instructions to the prompt:
```
IMPORTANT: Return your response as a valid JSON object with the following keys: [list of expected keys]. 
Do not include any additional text or explanation, only the JSON object.
```

### 3. **Improved Error Messages** (`GeminiActionsSection.tsx`)
The frontend now shows detailed, actionable error messages when field mappings fail, including:
- Common causes of the issue
- Step-by-step troubleshooting guide
- Links to relevant settings

## How to Configure UPDATE Actions Correctly

### Step 1: Create Your Action

1. Go to **Settings → AI Actions**
2. Click **Create Action**
3. Fill in basic details:
   - **Name**: e.g., "Update Candidate Skills"
   - **Description**: Brief explanation
   - **Entity Type**: Select the entity (e.g., CANDIDATE)

### Step 2: Configure Operation Type

1. Set **Operation Type** to **UPDATE** (or CREATE for new records)
2. This enables field mapping configuration

### Step 3: Add Field Mappings

Field mappings tell the system how to map Gemini's JSON response to your database fields.

**Example Configuration:**

If you want to update a candidate's skills and experience:

| Source Key (from Gemini) | Target Field (database) | Transform Rule |
|--------------------------|-------------------------|----------------|
| `extractedSkills`        | `skills`                | _(optional)_   |
| `yearsOfExperience`      | `experience`            | _(optional)_   |
| `educationLevel`         | `education`             | _(optional)_   |

### Step 4: Write Your Prompt Template

Your prompt should be clear about what format you expect. With the automatic JSON instruction, you don't need to explicitly ask for JSON anymore, but it still helps to be specific.

**Good Prompt Example:**
```
Analyze the following candidate profile and extract structured information:

Name: {{fullName}}
Resume: {{resume}}
Notes: {{notes}}

Extract:
- extractedSkills: comma-separated list of technical skills
- yearsOfExperience: total years of professional experience (number)
- educationLevel: highest education level achieved
```

**Bad Prompt Example:**
```
Tell me about this candidate: {{fullName}}
```
_(Too vague, doesn't guide Gemini to structure the response properly)_

## Example: Complete Working Configuration

### Scenario: Automatically extract and update candidate information from resume

**Action Configuration:**
- **Name**: Extract Candidate Info
- **Entity Type**: CANDIDATE
- **Operation Type**: UPDATE
- **Fields**: fullName, resume, notes

**Field Mappings:**
```json
[
  {
    "sourceKey": "skills",
    "targetField": "skills",
    "order": 0
  },
  {
    "sourceKey": "yearsExperience",
    "targetField": "experience",
    "order": 1
  },
  {
    "sourceKey": "educationLevel",
    "targetField": "education",
    "order": 2
  }
]
```

**Prompt Template:**
```
Review this candidate profile and extract the following information in JSON format:

Full Name: {{fullName}}
Resume/CV: {{resume}}
Additional Notes: {{notes}}

Analyze the above information and provide:
- skills: array of technical skills and competencies
- yearsExperience: estimated total years of work experience (as integer)
- educationLevel: highest education level (e.g., "Bachelor's", "Master's", "PhD")
```

**Expected Gemini Response:**
```json
{
  "skills": ["JavaScript", "React", "Node.js", "Python"],
  "yearsExperience": 5,
  "educationLevel": "Master's"
}
```

## Troubleshooting

### Issue: "No Changes Detected" Warning Appears

**Diagnosis Steps:**

1. **Check Backend Logs**
   - Look for field mapping diagnostic messages
   - Check if JSON parsing succeeded
   - See which keys were found/not found

2. **Inspect Gemini Response**
   - In the execution result modal, check the "Gemini Response" section
   - Is it valid JSON? Use a JSON validator if unsure
   - Do the keys match your field mappings exactly?

3. **Common Fixes:**

   **Problem**: Gemini returns text instead of JSON
   ```
   The candidate has 5 years of experience and skills in JavaScript and Python.
   ```
   **Solution**: Your prompt needs to be more explicit (though the system now adds JSON instructions automatically, sometimes Gemini still needs stronger guidance):
   ```
   Return ONLY a JSON object, no other text. Format: {"skills": [...], "yearsExperience": ...}
   ```

   **Problem**: Keys don't match
   ```json
   // Gemini returned:
   {"candidate_skills": ["JS"], "years": 5}
   
   // But your mapping expects:
   sourceKey: "skills", sourceKey: "yearsExperience"
   ```
   **Solution**: Update your field mappings to match: `candidate_skills` → `skills`, `years` → `yearsExperience`

   **Problem**: Gemini returns nested JSON
   ```json
   {
     "candidate": {
       "skills": ["JavaScript"],
       "experience": 5
     }
   }
   ```
   **Solution**: Use dot notation in sourceKey: `candidate.skills`, `candidate.experience`

### Issue: Apply Button Still Doesn't Show

If you've verified JSON is correct and keys match, check:

1. **Operation Type**: Must be UPDATE or CREATE (not READ_ONLY)
2. **Field Mappings**: Must have at least one mapping configured
3. **Values**: At least one mapped field must have a non-null value
4. **Already Applied**: The execution hasn't already been applied

### Testing Your Configuration

1. **Start Simple**: Test with just 1-2 field mappings first
2. **Use Ad-hoc Prompt**: Before saving, test with "Run ad-hoc prompt" to see what Gemini returns
3. **Check Logs**: Monitor backend logs when running the action
4. **Iterate**: Adjust your prompt based on what Gemini actually returns

## Backend Log Examples

When everything works correctly, you'll see logs like:
```
[AiActionExecutor] Successfully parsed Gemini response as JSON
[AiActionExecutor] Mapped field: skills -> skills
[AiActionExecutor] Mapped field: yearsExperience -> experience
[AiActionExecutor] Created proposed changes with 2 field(s)
```

When field mapping fails, you'll see:
```
[AiActionExecutor] Initial JSON parse failed, attempting to extract JSON from response
[AiActionExecutor] Field mapping failed: skills not found in Gemini response
[AiActionExecutor] No fields were successfully mapped from Gemini response. Available keys: candidate_skills, years
```

## Additional Tips

### 1. Use Specific Field Names in Prompts
Instead of generic terms, use the exact field names you want in the response:
```
Good: "Provide 'skills' as an array of strings"
Bad: "List their abilities"
```

### 2. Specify Data Types
Tell Gemini what type each field should be:
```
- skills: array of strings
- yearsExperience: integer number
- isActive: boolean
```

### 3. Provide Examples
Include an example response format in your prompt:
```
Example response format:
{
  "skills": ["JavaScript", "React"],
  "yearsExperience": 5
}
```

### 4. Handle Missing Data
Tell Gemini what to do when information isn't available:
```
If a field cannot be determined, use null or omit it entirely.
```

## Need Help?

If you're still experiencing issues:
1. Check the backend console logs for detailed diagnostics
2. Share the Gemini response and your field mapping configuration
3. Verify that the database field names in targetField actually exist in your schema

## Summary

The key to successful UPDATE actions:
✅ Configure field mappings with matching sourceKey names
✅ Write prompts that guide Gemini to return structured data
✅ Check logs to diagnose mapping failures
✅ Test with simple configurations first
✅ The system now automatically instructs Gemini to return JSON

