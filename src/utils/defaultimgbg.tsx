
export function getInitials(name: string) {
    if (!name) return "U";
  
    const words = name.trim().split(" ").filter(Boolean);
  
    if (words.length >= 2) {
      return (
        words[0][0].toUpperCase() +
        words[1][0].toUpperCase()
      );
    }
  
    return words[0].slice(0, 2).toUpperCase();
  }
  
  // deterministic color based on username
  export function getAvatarColor(name: string) {
    const colors = [
      "#6366F1", // indigo
      "#8B5CF6", // violet
      "#CA6BEF", // pink
      "#22C55E", // green
      "#0EA5E9", // sky
      "#F59E0B", // amber
    ];
  
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
  
    return colors[Math.abs(hash) % colors.length];
  }
  