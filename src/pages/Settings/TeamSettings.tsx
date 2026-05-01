import { OrganizationProfile } from '@clerk/react';

export default function TeamSettings() {
    return (
        <div className="p-8 max-w-6xl mx-auto h-full flex flex-col items-center justify-center">
            <div className="w-full max-w-4xl">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-[#e4e4e7] mb-2">Team Settings</h1>
                <p className="text-sm text-zinc-500 dark:text-[#71717a] mb-8">Manage workspace settings, team members, and roles.</p>
                
                <div className="flex justify-center w-full">
                    <OrganizationProfile 
                        appearance={{
                            elements: {
                                rootBox: "w-full",
                                card: "w-full shadow-none border border-zinc-200 dark:border-[#1f1f21]",
                                navbar: "bg-zinc-50 dark:bg-[#0a0a0b] border-r border-zinc-200 dark:border-[#1f1f21]",
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
