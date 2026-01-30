import React from 'react';
import Sidebar from './Sidebar';

const Layout = ({ children, currentModule, onModuleChange }) => {
    return (
        <div className="flex min-h-screen bg-gray-50">
            <Sidebar currentModule={currentModule} onModuleChange={onModuleChange} />
            <main className="ml-64 flex-1 p-8 md:p-12 pb-96 overflow-y-auto max-w-[1600px] w-full mx-auto">
                {children}
            </main>
        </div>
    );
};

export default Layout;
