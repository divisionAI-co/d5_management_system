# Quick Fix Checklist - Gemini UPDATE Actions

## ✅ Immediate Steps to Fix Your Action

### 1. Restart Backend Server
```bash
cd apps/backend
npm run start:dev
```
The enhanced logging needs the server restart to take effect.

### 2. Run Your Action Again
- Navigate to the entity record
- Click "Run action" on your Gemini action
- Wait for execution to complete

### 3. Check What You See

#### ✅ If Apply Button Appears
**Success!** The automatic JSON instruction fixed your issue. Click "Apply Changes" to update the record.

#### ❌ If "No Changes Detected" Warning Appears
Look at the **Expected field mappings** section in the error message. It shows:
- The exact keys Gemini should return
- Your current field mappings

### 4. Compare Response with Expected Keys

Open the **Gemini Response** section and check:

**Is it valid JSON?**
- ✅ YES → Go to Step 5
- ❌ NO → Go to Step 6

### 5. Keys Match?

Compare the JSON keys in Gemini's response with the expected keys shown in the error.

**Example:**
- Expected: `skills`, `yearsExperience`
- Gemini returned: `candidate_skills`, `years`

**Fix:** Update your field mappings in Settings → AI Actions:
- Change sourceKey from `skills` to `candidate_skills`
- Change sourceKey from `yearsExperience` to `years`

### 6. Response is Not JSON?

Your prompt needs to be more explicit. Edit the action in Settings → AI Actions:

**Add to your prompt:**
```
Extract the following information and return as JSON:
- skills: array of technical skills
- yearsExperience: integer years of experience

Return ONLY the JSON object, no other text.
```

## 🔍 Backend Logs Quick Reference

### ✅ Success Logs
```
[AiActionExecutor] Successfully parsed Gemini response as JSON
[AiActionExecutor] Mapped field: skills -> skills
[AiActionExecutor] Created proposed changes with 2 field(s)
```

### ❌ Failure Logs
```
[AiActionExecutor] No JSON structure found in Gemini response
[AiActionExecutor] Field mapping failed: skills not found
[AiActionExecutor] Available keys: candidate_skills, experience_years
```

**What to do:**
- Look at "Available keys" in the log
- Update your field mappings to use those keys

## 🎯 Common Fixes

### Fix 1: Update Field Mappings
**Settings → AI Actions → [Your Action] → Field Mappings**

Change:
```
sourceKey: "skills"  →  sourceKey: "candidate_skills"
```

### Fix 2: Be More Explicit in Prompt
Add this template at the end of your prompt:
```
Return your response in this exact JSON format:
{
  "skills": ["skill1", "skill2"],
  "yearsExperience": 5
}
```

### Fix 3: Handle Nested JSON
If Gemini returns:
```json
{
  "candidate": {
    "skills": ["JavaScript"]
  }
}
```

Use dot notation in sourceKey: `candidate.skills`

## 📊 Testing Checklist

- [ ] Backend server restarted
- [ ] Action executed successfully (status = SUCCESS)
- [ ] Backend logs show field mapping attempts
- [ ] Gemini response is valid JSON (use jsonlint.com)
- [ ] JSON keys match field mapping sourceKeys (case-sensitive!)
- [ ] At least one field has a non-null value

## 🚀 Quick Test Action

Create a simple test action to verify everything works:

**Name:** Test Skills Extraction
**Entity Type:** CANDIDATE
**Operation Type:** UPDATE
**Prompt:**
```
Candidate: {{fullName}}

Extract skills and experience. Return JSON: {"skills": ["skill1"], "yearsExperience": 5}
```

**Field Mappings:**
- sourceKey: `skills` → targetField: `skills`
- sourceKey: `yearsExperience` → targetField: `experience`

Run this. If it works, your system is configured correctly!

## 📖 Need More Details?

- Full guide: `GEMINI_UPDATE_ACTION_GUIDE.md`
- Summary of changes: `GEMINI_ACTION_FIX_SUMMARY.md`

## 💡 Pro Tips

1. **Test in stages**: Start with 1 field mapping, then add more
2. **Check logs first**: They tell you exactly what went wrong
3. **Case matters**: `skills` ≠ `Skills` ≠ `SKILLS`
4. **Null values**: If all values are null, Gemini needs more context in the prompt
5. **Complex data**: For arrays/objects, ensure Gemini returns proper JSON structure

## Still Not Working?

Share these with someone who can help:
1. The backend log output
2. The Gemini response (from the UI)
3. Your field mapping configuration
4. Your prompt template

The logs will show exactly where the mapping is failing!

