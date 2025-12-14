import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useAuth from '../hooks/useAuth';

export default function AuthCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { setSession, user } = useAuth();
    const token = searchParams.get('token');

    useEffect(() => {
        if (token) {
            setSession(token);
        } else {
            navigate('/auth');
        }
    }, [token, setSession, navigate]);

    useEffect(() => {
        if (user) {
            navigate(user.role === 'tutor' ? '/tutordashboard' : '/studentdashboard');
        }
    }, [user, navigate]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">Authenticating...</h2>
                <p className="text-gray-600">Please wait while we log you in.</p>
            </div>
        </div>
    );
}
