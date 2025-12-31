/**
 * Fetches the latest release version from the OrangeSideBar GitHub repository.
 */
export async function getLatestVersion(): Promise<string> {
    try {
        const response = await fetch('https://api.github.com/repos/zhiyu1998/OrangeSideBar/releases/latest');
        if (!response.ok) {
            throw new Error('Failed to fetch version');
        }
        const data = await response.json();
        return data.tag_name || 'v1.0.0';
    } catch (error) {
        console.error('Error fetching version:', error);
        return 'v1.0.0'; // Fallback
    }
}
