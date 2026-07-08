import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

with open('target.txt', 'r') as f:
    target_content = f.read()

# Remove target_content
content = content.replace(target_content, "")

# Find where to insert
insert_marker = "          {/* RANK / LEADERBOARD */}"

progress_section = """
          {/* PROGRESS */}
          {appState === AppState.PROGRESS && (
            <motion.div 
              key="progress"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-12"
            >
""" + target_content + """
            </motion.div>
          )}

"""

content = content.replace(insert_marker, progress_section + insert_marker)

# Wait, "Inspiration" and "My routines" are already modified to be non-italic, let's verify
# I'll also modify "Progress" header to be non-italic to be consistent
content = content.replace('<h3 className="font-sans font-black text-lg md:text-xl uppercase italic tracking-tight">Progress</h3>', '<h3 className="font-sans font-black text-lg md:text-xl uppercase tracking-tight">Progress</h3>')

# Also check for "My routines" and "Inspiration" in case they were missed
content = content.replace('<h3 className="font-sans font-black text-lg md:text-xl uppercase italic tracking-tight">My routines</h3>', '<h3 className="font-sans font-black text-lg md:text-xl uppercase tracking-tight">My routines</h3>')
content = content.replace('<h3 className="font-sans font-black text-lg md:text-xl uppercase italic tracking-tight text-black flex items-center gap-2">', '<h3 className="font-sans font-black text-lg md:text-xl uppercase tracking-tight text-black flex items-center gap-2">')

with open('src/App.tsx', 'w') as f:
    f.write(content)
