import { OrganizationProfile } from '@clerk/react';

export default function TeamSettings() {
    return (
        <div className="p-8 max-w-6xl mx-auto h-full flex flex-col items-center justify-center">
            <div className="w-full max-w-4xl">
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900 mb-2">Team Settings</h1>
                <p className="text-sm text-zinc-500 mb-8">Manage workspace settings, team members, and roles.</p>
                
                <div className="flex justify-center w-full">
                    <OrganizationProfile 
                        appearance={{
                            elements: {
                                rootBox: "w-full",
                                card: "w-full shadow-none border border-zinc-200",
                                navbar: "bg-zinc-50 border-r border-zinc-200",
                            }
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
